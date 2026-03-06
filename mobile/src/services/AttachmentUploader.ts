import * as FileSystem from 'expo-file-system';
import { Attachment, UploadedAttachment } from '../types/attachment';

/**
 * Uploads a local attachment to the MCP server's /api/attachments endpoint.
 * Uses expo-file-system uploadAsync for reliable binary uploads on React Native.
 */
export async function uploadAttachment(
  attachment: Attachment,
  host: string,
  mcpPort: number,
  authToken: string,
): Promise<UploadedAttachment> {
  if (!attachment.localUri) {
    throw new Error(`No local file for attachment: ${attachment.filename}`);
  }

  const url = `http://${host}:${mcpPort}/api/attachments`;

  const result = await FileSystem.uploadAsync(url, attachment.localUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': attachment.mimeType,
      'X-Filename': attachment.filename,
      'Authorization': `Bearer ${authToken}`,
    },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (${result.status}): ${result.body || 'Unknown error'}`);
  }

  return JSON.parse(result.body) as UploadedAttachment;

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Upload failed (${response.status}): ${body || response.statusText}`);
  }

  return response.json() as Promise<UploadedAttachment>;
}
