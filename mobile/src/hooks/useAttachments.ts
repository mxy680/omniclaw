import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Attachment, fileExtension } from '../types/attachment';

function getExtensionFromMimeType(mimeType: string): string {
  // Create a temporary attachment-like object to reuse the existing helper
  return fileExtension({ id: '', filename: '', mimeType, byteCount: 0 });
}

async function ensureAttachmentsDir(): Promise<void> {
  const dir = `${FileSystem.documentDirectory}attachments/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

export function useAttachments() {
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);

  const pickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.7,
    });
    if (result.canceled) return;

    await ensureAttachmentsDir();

    for (const asset of result.assets) {
      const id = Crypto.randomUUID();
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const ext = getExtensionFromMimeType(mimeType);
      const filename = asset.fileName ?? `photo-${id}.${ext}`;
      const destUri = `${FileSystem.documentDirectory}attachments/${id}.${ext}`;

      await FileSystem.copyAsync({ from: asset.uri, to: destUri });

      const info = await FileSystem.getInfoAsync(destUri);
      const byteCount = info.exists && 'size' in info ? (info.size ?? 0) : 0;

      setPendingAttachments(prev => [
        ...prev,
        { id, filename, mimeType, byteCount, localUri: destUri },
      ]);
    }
  }, []);

  const pickFromCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;

    await ensureAttachmentsDir();

    const id = Crypto.randomUUID();
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext = getExtensionFromMimeType(mimeType);
    const filename = asset.fileName ?? `photo-${id}.${ext}`;
    const destUri = `${FileSystem.documentDirectory}attachments/${id}.${ext}`;

    await FileSystem.copyAsync({ from: asset.uri, to: destUri });

    const info = await FileSystem.getInfoAsync(destUri);
    const byteCount = info.exists && 'size' in info ? (info.size ?? 0) : 0;

    setPendingAttachments(prev => [
      ...prev,
      { id, filename, mimeType, byteCount, localUri: destUri },
    ]);
  }, []);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;

    await ensureAttachmentsDir();

    const id = Crypto.randomUUID();
    const mimeType = asset.mimeType ?? 'application/pdf';
    const filename = asset.name ?? `document-${id}.pdf`;
    const destUri = `${FileSystem.documentDirectory}attachments/${id}.pdf`;

    await FileSystem.copyAsync({ from: asset.uri, to: destUri });

    const info = await FileSystem.getInfoAsync(destUri);
    const byteCount = info.exists && 'size' in info ? (info.size ?? 0) : 0;

    setPendingAttachments(prev => [
      ...prev,
      { id, filename, mimeType, byteCount, localUri: destUri },
    ]);
  }, []);

  const removeAttachment = useCallback((attachment: Attachment) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== attachment.id));
    // Best-effort delete of the local copy; ignore errors
    if (attachment.localUri) {
      FileSystem.deleteAsync(attachment.localUri, { idempotent: true }).catch(() => {});
    }
  }, []);

  const clearPending = useCallback(() => {
    setPendingAttachments([]);
  }, []);

  return {
    pendingAttachments,
    pickFromLibrary,
    pickFromCamera,
    pickDocument,
    removeAttachment,
    clearPending,
  };
}
