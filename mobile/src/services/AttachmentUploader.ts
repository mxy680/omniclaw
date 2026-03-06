import * as FileSystem from 'expo-file-system';
import { Attachment, UploadedAttachment } from '../types/attachment';

/**
 * Uploads a local attachment to the MCP server's /api/attachments endpoint.
 * Reads the file as base64 via expo-file-system, then sends as raw binary
 * using XMLHttpRequest (which handles base64→binary correctly on RN).
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

  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(attachment.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Use XMLHttpRequest which supports base64→binary on React Native
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', attachment.mimeType);
    xhr.setRequestHeader('X-Filename', attachment.filename);
    xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    xhr.responseType = 'text';

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as UploadedAttachment);
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || 'Unknown error'}`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed: network error'));

    // Convert base64 to Uint8Array for sending
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    xhr.send(bytes);
  });
}
