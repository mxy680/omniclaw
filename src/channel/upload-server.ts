import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { randomUUID } from "crypto";
import { mkdirSync, createWriteStream, createReadStream, statSync, existsSync, readdirSync } from "fs";
import { join, extname } from "path";
import { homedir } from "os";
import { lookup } from "mime-types";

const UPLOADS_BASE = join(homedir(), ".openclaw", "uploads");
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/** Reject path segments that could escape the uploads directory. */
function isSafePathSegment(s: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(s) && !s.includes("..");
}

export type UploadServerInstance = {
  stop: () => void;
};

/**
 * Resolve the on-disk path for an uploaded file.
 * Returns undefined if the file doesn't exist.
 */
export function resolveUploadPath(conversationId: string, fileId: string): string | undefined {
  if (!isSafePathSegment(conversationId) || !isSafePathSegment(fileId)) return undefined;
  const dir = join(UPLOADS_BASE, conversationId);
  if (!existsSync(dir)) return undefined;
  const files = readdirSync(dir);
  const match = files.find((f) => f.startsWith(fileId));
  return match ? join(dir, match) : undefined;
}

/**
 * Start an HTTP server for file uploads and serving uploaded files.
 */
export function startUploadServer(opts: {
  port: number;
  authToken: string;
  log?: (msg: string) => void;
}): UploadServerInstance {
  const { authToken, log } = opts;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    // POST /upload — file upload
    if (req.method === "POST" && url.pathname === "/upload") {
      handleUpload(req, res, authToken, log);
      return;
    }

    // GET /uploads/:conversationId/:fileId — serve files
    const serveMatch = url.pathname.match(/^\/uploads\/([^/]+)\/([^/]+)$/);
    if (req.method === "GET" && serveMatch) {
      const token = url.searchParams.get("token");
      if (token !== authToken) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      serveFile(res, serveMatch[1], serveMatch[2], log);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      log?.(`[ios] Upload HTTP port ${opts.port + 1} already in use (existing server still running)`);
    } else {
      log?.(`[ios] Upload HTTP server error: ${err.message}`);
    }
  });

  server.listen(opts.port + 1, () => {
    log?.(`[ios] Upload HTTP server listening on port ${opts.port + 1}`);
  });

  return {
    stop: () => {
      server.close();
      log?.("[ios] Upload HTTP server stopped");
    },
  };
}

function handleUpload(
  req: IncomingMessage,
  res: ServerResponse,
  authToken: string,
  log?: (msg: string) => void,
): void {
  // Validate auth
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${authToken}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const contentType = req.headers["content-type"] ?? "";

  // Parse multipart boundary
  const boundaryMatch = contentType.match(/boundary="?([^";,]+)"?/);
  if (!boundaryMatch) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "missing multipart boundary" }));
    return;
  }

  // Collect body
  const chunks: Buffer[] = [];
  let totalSize = 0;
  let aborted = false;

  req.on("data", (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > MAX_FILE_SIZE) {
      if (!aborted) {
        aborted = true;
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "file too large", maxBytes: MAX_FILE_SIZE }));
        req.destroy();
      }
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", () => {
    if (aborted) return;
    try {
      const body = Buffer.concat(chunks);
      const boundary = boundaryMatch![1];
      const { conversationId, filename, mimeType, fileBuffer } = parseMultipart(body, boundary);

      if (!conversationId || !fileBuffer) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "missing conversationId or file" }));
        return;
      }

      if (!isSafePathSegment(conversationId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid conversationId" }));
        return;
      }

      // Save file
      const fileId = randomUUID().slice(0, 8);
      const sanitized = (filename ?? "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
      const dir = join(UPLOADS_BASE, conversationId);
      mkdirSync(dir, { recursive: true });
      const filePath = join(dir, `${fileId}-${sanitized}`);

      const ws = createWriteStream(filePath);
      ws.write(fileBuffer);
      ws.end();

      const resolvedMime = mimeType ?? (lookup(sanitized) || "application/octet-stream");

      log?.(`[ios] uploaded ${sanitized} (${fileBuffer.length} bytes) → ${filePath}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          fileId,
          filename: sanitized,
          mimeType: resolvedMime,
          size: fileBuffer.length,
        }),
      );
    } catch (err) {
      log?.(`[ios] upload parse error: ${err}`);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "failed to parse upload" }));
    }
  });
}

function parseMultipart(
  body: Buffer,
  boundary: string,
): { conversationId?: string; filename?: string; mimeType?: string; fileBuffer?: Buffer } {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let conversationId: string | undefined;
  let filename: string | undefined;
  let mimeType: string | undefined;
  let fileBuffer: Buffer | undefined;

  // Split by boundary
  const parts: Buffer[] = [];
  let start = 0;
  while (true) {
    const idx = body.indexOf(boundaryBuffer, start);
    if (idx === -1) break;
    if (start > 0) {
      parts.push(body.subarray(start, idx));
    }
    start = idx + boundaryBuffer.length;
    // Skip \r\n after boundary
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headers = part.subarray(0, headerEnd).toString();
    const content = part.subarray(headerEnd + 4);
    // Trim trailing \r\n
    const trimmed = content.subarray(
      0,
      content.length >= 2 &&
        content[content.length - 2] === 0x0d &&
        content[content.length - 1] === 0x0a
        ? content.length - 2
        : content.length,
    );

    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const contentTypeMatch = headers.match(/Content-Type:\s*(.+)/i);

    if (nameMatch?.[1] === "conversationId") {
      conversationId = trimmed.toString().trim();
    } else if (nameMatch?.[1] === "file" || filenameMatch) {
      filename = filenameMatch?.[1];
      mimeType = contentTypeMatch?.[1]?.trim();
      fileBuffer = trimmed;
    }
  }

  return { conversationId, filename, mimeType, fileBuffer };
}

function serveFile(
  res: ServerResponse,
  conversationId: string,
  fileId: string,
  log?: (msg: string) => void,
): void {
  const filePath = resolveUploadPath(conversationId, fileId);
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "file not found" }));
    return;
  }

  const stat = statSync(filePath);
  const ext = extname(filePath);
  const mime = lookup(ext) || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": stat.size,
    "Cache-Control": "private, max-age=86400",
  });

  createReadStream(filePath).pipe(res);
}
