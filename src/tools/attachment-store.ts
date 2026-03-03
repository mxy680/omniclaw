import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import * as path from "path";
import * as os from "os";

export interface AttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  byteCount: number;
  createdAt: string;
}

const ATTACHMENTS_DIR = path.join(os.homedir(), ".openclaw", "attachments");
const META_FILE = path.join(ATTACHMENTS_DIR, "_meta.json");

function ensureDir() {
  if (!existsSync(ATTACHMENTS_DIR)) {
    mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }
}

function loadMeta(): Record<string, AttachmentMeta> {
  ensureDir();
  if (!existsSync(META_FILE)) return {};
  try {
    return JSON.parse(readFileSync(META_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveMeta(meta: Record<string, AttachmentMeta>) {
  writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}

export function saveAttachment(buffer: Buffer, filename: string, mimeType: string): AttachmentMeta {
  ensureDir();
  const id = randomUUID();
  const ext = path.extname(filename) || ".bin";
  const storedName = `${id}${ext}`;
  const filePath = path.join(ATTACHMENTS_DIR, storedName);
  writeFileSync(filePath, buffer);

  const meta: AttachmentMeta = {
    id,
    filename,
    mimeType,
    byteCount: buffer.length,
    createdAt: new Date().toISOString(),
  };

  const allMeta = loadMeta();
  allMeta[id] = meta;
  saveMeta(allMeta);

  return meta;
}

export function getAttachment(id: string): { meta: AttachmentMeta; data: Buffer } | null {
  const allMeta = loadMeta();
  const meta = allMeta[id];
  if (!meta) return null;

  const ext = path.extname(meta.filename) || ".bin";
  const filePath = path.join(ATTACHMENTS_DIR, `${id}${ext}`);
  if (!existsSync(filePath)) return null;

  return { meta, data: readFileSync(filePath) };
}

export function listAttachments(): AttachmentMeta[] {
  return Object.values(loadMeta());
}
