import { File } from 'expo-file-system';
import { Attachment, UploadedAttachment } from '../types/attachment';

/**
 * Uploads a local attachment to the MCP server's /api/attachments endpoint.
 * Reads raw bytes via expo-file-system File.bytes() and sends via XHR.
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
  const file = new File(attachment.localUri);
  const bytes = await file.bytes();

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
    xhr.send(bytes);
  });
}
