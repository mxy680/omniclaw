import { File } from 'expo-file-system';
import { Attachment, UploadedAttachment } from '../types/attachment';

/**
 * Uploads a local attachment to the MCP server's /api/attachments endpoint.
 * Uses the new expo-file-system File class which implements Blob,
 * allowing direct use as a fetch body.
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

  // expo-file-system File implements Blob in SDK 54 — use it directly as
  // the fetch body. Creating a new Blob from ArrayBuffer isn't supported
  // on Hermes.
  const file = new File(attachment.localUri);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': attachment.mimeType,
      'X-Filename': attachment.filename,
      'Authorization': `Bearer ${authToken}`,
    },
    body: file,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Upload failed (${response.status}): ${body || response.statusText}`);
  }

  return response.json() as Promise<UploadedAttachment>;
}
