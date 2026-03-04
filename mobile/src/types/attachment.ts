export interface Attachment {
  id: string;       // UUID string
  filename: string;
  mimeType: string;
  byteCount: number;
  localUri?: string; // Local file path on device (only present for pending/local attachments)
}

export interface UploadedAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export function isImage(a: Attachment): boolean {
  return a.mimeType.startsWith('image/');
}

export function isPDF(a: Attachment): boolean {
  return a.mimeType === 'application/pdf';
}

export function fileExtension(a: Attachment): string {
  switch (a.mimeType) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/heic': return 'heic';
    case 'image/gif': return 'gif';
    case 'application/pdf': return 'pdf';
    default: return 'bin';
  }
}
