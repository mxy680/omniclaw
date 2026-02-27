import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Type } from "@sinclair/typebox";
import { jsonResult } from "./nutrition-utils.js";

const WORKSPACE_DIR = path.join(os.homedir(), ".openclaw", "workspace");
const MEMORY_DIR = path.join(WORKSPACE_DIR, "memory");
const MEMORY_MD = path.join(WORKSPACE_DIR, "MEMORY.md");

/** Sanitise a topic string and return its absolute path under MEMORY_DIR. */
function topicToPath(topic: string): string {
  // Reject traversal attempts and absolute paths
  if (topic.includes("..") || path.isAbsolute(topic)) {
    throw new Error(`Invalid topic: "${topic}" — must be a relative path without "..")`);
  }
  // Normalise and strip leading/trailing slashes
  const normalised = topic.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalised) throw new Error("Topic cannot be empty");
  return path.join(MEMORY_DIR, `${normalised}.md`);
}

/**
 * Rebuild the `## Memory Topics` section at the bottom of MEMORY.md.
 * Preserves everything above that heading. If the heading doesn't exist yet
 * it is appended.
 */
async function regenerateIndex(): Promise<void> {
  // Collect all .md files recursively under MEMORY_DIR
  const topics: { topic: string; size: number; modified: string; firstLine: string }[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".md")) {
        const rel = path.relative(MEMORY_DIR, full);
        const topic = rel.replace(/\.md$/, "").replace(/\\/g, "/");
        const stat = fs.statSync(full);
        const content = fs.readFileSync(full, "utf-8");
        const firstLine = content.split("\n").find((l) => l.trim())?.trim() ?? "";
        topics.push({
          topic,
          size: stat.size,
          modified: stat.mtime.toISOString().split("T")[0],
          firstLine: firstLine.slice(0, 120),
        });
      }
    }
  }

  walk(MEMORY_DIR);
  topics.sort((a, b) => a.topic.localeCompare(b.topic));

  // Build the index section
  const lines: string[] = ["## Memory Topics", ""];
  if (topics.length === 0) {
    lines.push("_No memory topics saved yet._");
  } else {
    lines.push("| Topic | Modified | Size | Summary |");
    lines.push("|-------|----------|------|---------|");
    for (const t of topics) {
      lines.push(`| \`${t.topic}\` | ${t.modified} | ${t.size}B | ${t.firstLine} |`);
    }
  }
  lines.push("");

  // Read existing MEMORY.md
  let existing = "";
  if (fs.existsSync(MEMORY_MD)) {
    existing = fs.readFileSync(MEMORY_MD, "utf-8");
  }

  // Find and replace the section, or append it
  const sectionHeader = "## Memory Topics";
  const idx = existing.indexOf(sectionHeader);
  let before: string;
  if (idx >= 0) {
    before = existing.slice(0, idx).trimEnd();
  } else {
    before = existing.trimEnd();
  }

  const newContent = before + "\n\n" + lines.join("\n");
  fs.writeFileSync(MEMORY_MD, newContent, "utf-8");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMemorySaveTool(): any {
  return {
    name: "memory_save",
    label: "Save Memory",
    description:
      "Save a memory topic. Writes content to a topic file and updates the topic index in MEMORY.md. " +
      "Topics support hierarchy with '/' (e.g. 'school/csds-344', 'projects/omniclaw'). " +
      "If the topic already exists, it is overwritten.",
    parameters: Type.Object({
      topic: Type.String({
        description:
          "Topic name — use '/' for hierarchy (e.g. 'school/csds-344', 'preferences/food'). " +
          "Stored as memory/<topic>.md.",
      }),
      content: Type.String({
        description: "Markdown content to save. Start with a brief one-line summary.",
      }),
    }),
    async execute(
      _toolCallId: string,
      params: { topic: string; content: string },
    ) {
      try {
        const filePath = topicToPath(params.topic);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, params.content, "utf-8");
        await regenerateIndex();
        return jsonResult({
          status: "saved",
          topic: params.topic,
          path: filePath,
          bytes: Buffer.byteLength(params.content, "utf-8"),
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMemoryReadTool(): any {
  return {
    name: "memory_read",
    label: "Read Memory",
    description:
      "Read the content of a memory topic file. Use memory_list first to discover available topics.",
    parameters: Type.Object({
      topic: Type.String({
        description: "Topic name to read (e.g. 'school/csds-344').",
      }),
    }),
    async execute(
      _toolCallId: string,
      params: { topic: string },
    ) {
      try {
        const filePath = topicToPath(params.topic);
        if (!fs.existsSync(filePath)) {
          return jsonResult({ error: `Topic "${params.topic}" not found` });
        }
        const content = fs.readFileSync(filePath, "utf-8");
        return jsonResult({
          topic: params.topic,
          content,
          bytes: Buffer.byteLength(content, "utf-8"),
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMemoryListTool(): any {
  return {
    name: "memory_list",
    label: "List Memories",
    description:
      "List all saved memory topics with sizes, dates, and first-line summaries. " +
      "Optionally filter by prefix (e.g. 'school' lists only school/* topics).",
    parameters: Type.Object({
      prefix: Type.Optional(
        Type.String({
          description:
            "Only return topics starting with this prefix (e.g. 'school' matches 'school/csds-344').",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { prefix?: string },
    ) {
      try {
        const topics: { topic: string; size: number; modified: string; firstLine: string }[] = [];

        function walk(dir: string) {
          if (!fs.existsSync(dir)) return;
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(full);
            } else if (entry.name.endsWith(".md")) {
              const rel = path.relative(MEMORY_DIR, full);
              const topic = rel.replace(/\.md$/, "").replace(/\\/g, "/");
              if (params.prefix && !topic.startsWith(params.prefix)) return;
              const stat = fs.statSync(full);
              const content = fs.readFileSync(full, "utf-8");
              const firstLine = content.split("\n").find((l) => l.trim())?.trim() ?? "";
              topics.push({
                topic,
                size: stat.size,
                modified: stat.mtime.toISOString().split("T")[0],
                firstLine: firstLine.slice(0, 120),
              });
            }
          }
        }

        walk(MEMORY_DIR);
        topics.sort((a, b) => a.topic.localeCompare(b.topic));

        return jsonResult({ topics, count: topics.length });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMemoryDeleteTool(): any {
  return {
    name: "memory_delete",
    label: "Delete Memory",
    description:
      "Delete a memory topic file and update the topic index in MEMORY.md.",
    parameters: Type.Object({
      topic: Type.String({
        description: "Topic name to delete (e.g. 'test/hello').",
      }),
    }),
    async execute(
      _toolCallId: string,
      params: { topic: string },
    ) {
      try {
        const filePath = topicToPath(params.topic);
        if (!fs.existsSync(filePath)) {
          return jsonResult({ error: `Topic "${params.topic}" not found` });
        }
        fs.unlinkSync(filePath);

        // Clean up empty parent directories
        let dir = path.dirname(filePath);
        while (dir !== MEMORY_DIR && dir.startsWith(MEMORY_DIR)) {
          const entries = fs.readdirSync(dir);
          if (entries.length === 0) {
            fs.rmdirSync(dir);
            dir = path.dirname(dir);
          } else {
            break;
          }
        }

        await regenerateIndex();
        return jsonResult({ status: "deleted", topic: params.topic });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMemoryUpdateIndexTool(): any {
  return {
    name: "memory_update_index",
    label: "Update Memory Index",
    description:
      "Rebuild the '## Memory Topics' section in MEMORY.md from current topic files. " +
      "Useful if topic files were edited outside of memory_save/memory_delete.",
    parameters: Type.Object({}),
    async execute() {
      try {
        await regenerateIndex();
        return jsonResult({ status: "index_updated" });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
