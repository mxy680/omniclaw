import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File, Directory, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Attachment, fileExtension } from '../types/attachment';

function getExtensionFromMimeType(mimeType: string): string {
  return fileExtension({ id: '', filename: '', mimeType, byteCount: 0 });
}

function attachmentsDir(): Directory {
  return new Directory(Paths.document, 'attachments');
}

function ensureAttachmentsDir(): void {
  const dir = attachmentsDir();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
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

    ensureAttachmentsDir();

    for (const asset of result.assets) {
      const id = Crypto.randomUUID();
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const ext = getExtensionFromMimeType(mimeType);
      const filename = asset.fileName ?? `photo-${id}.${ext}`;

      const source = new File(asset.uri);
      const dest = new File(attachmentsDir(), `${id}.${ext}`);
      source.copy(dest);

      setPendingAttachments(prev => [
        ...prev,
        { id, filename, mimeType, byteCount: dest.size, localUri: dest.uri },
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

    ensureAttachmentsDir();

    const id = Crypto.randomUUID();
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext = getExtensionFromMimeType(mimeType);
    const filename = asset.fileName ?? `photo-${id}.${ext}`;

    const source = new File(asset.uri);
    const dest = new File(attachmentsDir(), `${id}.${ext}`);
    source.copy(dest);

    setPendingAttachments(prev => [
      ...prev,
      { id, filename, mimeType, byteCount: dest.size, localUri: dest.uri },
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

    ensureAttachmentsDir();

    const id = Crypto.randomUUID();
    const mimeType = asset.mimeType ?? 'application/pdf';
    const filename = asset.name ?? `document-${id}.pdf`;

    const source = new File(asset.uri);
    const dest = new File(attachmentsDir(), `${id}.pdf`);
    source.copy(dest);

    setPendingAttachments(prev => [
      ...prev,
      { id, filename, mimeType, byteCount: dest.size, localUri: dest.uri },
    ]);
  }, []);

  const removeAttachment = useCallback((attachment: Attachment) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== attachment.id));
    if (attachment.localUri) {
      try { new File(attachment.localUri).delete(); } catch {}
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
