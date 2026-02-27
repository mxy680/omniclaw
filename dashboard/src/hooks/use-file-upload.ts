import { useState, useCallback, useRef } from "react";

export interface UploadedFile {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface PendingFile {
  file: File;
  preview?: string;
  uploading: boolean;
  uploaded?: UploadedFile;
  error?: string;
}

export function useFileUpload(serverUrl: string, authToken: string) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const getHttpUrl = useCallback(() => {
    try {
      const wsUrl = new URL(serverUrl);
      const protocol = wsUrl.protocol === "wss:" ? "https:" : "http:";
      const port = parseInt(wsUrl.port || "9600", 10) + 1;
      return `${protocol}//${wsUrl.hostname}:${port}`;
    } catch {
      return "";
    }
  }, [serverUrl]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newPending: PendingFile[] = Array.from(files).map((file) => {
      const pending: PendingFile = { file, uploading: false };
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPendingFiles((prev) =>
            prev.map((p) =>
              p.file === file ? { ...p, preview: e.target?.result as string } : p,
            ),
          );
        };
        reader.readAsDataURL(file);
      }
      return pending;
    });
    setPendingFiles((prev) => [...prev, ...newPending]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const uploadAll = useCallback(
    async (conversationId: string): Promise<UploadedFile[]> => {
      const httpUrl = getHttpUrl();
      if (!httpUrl) return [];

      const controller = new AbortController();
      abortRef.current = controller;

      const results: UploadedFile[] = [];

      for (let i = 0; i < pendingFiles.length; i++) {
        const pf = pendingFiles[i];
        if (pf.uploaded) {
          results.push(pf.uploaded);
          continue;
        }

        setPendingFiles((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, uploading: true } : p)),
        );

        try {
          const formData = new FormData();
          formData.append("conversationId", conversationId);
          formData.append("file", pf.file, pf.file.name);

          const res = await fetch(`${httpUrl}/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}` },
            body: formData,
            signal: controller.signal,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "upload failed" }));
            throw new Error(err.error ?? `HTTP ${res.status}`);
          }

          const uploaded: UploadedFile = await res.json();
          results.push(uploaded);

          setPendingFiles((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, uploading: false, uploaded } : p,
            ),
          );
        } catch (err) {
          setPendingFiles((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, uploading: false, error: String(err) } : p,
            ),
          );
        }
      }

      return results;
    },
    [pendingFiles, getHttpUrl, authToken],
  );

  const clear = useCallback(() => {
    setPendingFiles([]);
  }, []);

  return {
    pendingFiles,
    addFiles,
    removeFile,
    uploadAll,
    clear,
    hasPending: pendingFiles.length > 0,
  };
}
