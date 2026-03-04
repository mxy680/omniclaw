import * as FileSystem from 'expo-file-system';
import { Attachment, UploadedAttachment } from '../types/attachment';

/**
 * Uploads a local attachment to the MCP server's /api/attachments endpoint.
 * Uses the file:// URI directly — React Native's fetch supports it for uploads.
 * Falls back to base64 read + Blob construction if needed.
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

  // Read file as base64 and construct a Blob so we can send binary data via fetch.
  // This is the most reliable cross-platform approach in React Native / Expo.
  const base64 = await FileSystem.readAsStringAsync(attachment.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Convert base64 to a Uint8Array for binary upload
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: attachment.mimeType });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': attachment.mimeType,
      'X-Filename': attachment.filename,
      'Authorization': `Bearer ${authToken}`,
    },
    body: blob,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Upload failed (${response.status}): ${body || response.statusText}`);
  }

  return response.json() as Promise<UploadedAttachment>;
}
