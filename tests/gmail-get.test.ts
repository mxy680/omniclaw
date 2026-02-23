import type { Credentials } from "google-auth-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGmailGetTool } from "../src/tools/gmail-get.js";

// ---------------------------------------------------------------------------
// Mock googleapis
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  messagesGet: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    gmail: () => ({ users: { messages: { get: mocks.messagesGet } } }),
    auth: {
      OAuth2: class {
        setCredentials = vi.fn();
        on = vi.fn();
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeClientManager(initial: Record<string, Credentials> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getClient: vi.fn().mockReturnValue({ setCredentials: vi.fn(), on: vi.fn() }),
    getRawClient: vi.fn().mockReturnValue({ setCredentials: vi.fn(), on: vi.fn() }),
    setCredentials: vi.fn(),
    listAccounts: () => Array.from(store.keys()),
  };
}

function b64(str: string) {
  return Buffer.from(str).toString("base64");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("createGmailGetTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth_required when account has no stored token", async () => {
    const tool = createGmailGetTool(makeClientManager() as any);
    const result = await tool.execute("call-1", { id: "msg123" });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("returns parsed fields for a single-part text/plain message", async () => {
    const cm = makeClientManager({ default: { access_token: "tok" } });
    const tool = createGmailGetTool(cm as any);

    mocks.messagesGet.mockResolvedValue({
      data: {
        id: "msg123",
        payload: {
          mimeType: "text/plain",
          headers: [
            { name: "Subject", value: "Hello there" },
            { name: "From", value: "alice@example.com" },
            { name: "To", value: "bob@example.com" },
            { name: "Date", value: "Mon, 22 Feb 2026 10:00:00 +0000" },
          ],
          body: { data: b64("Plain text content") },
          parts: null,
        },
      },
    });

    const result = await tool.execute("call-1", { id: "msg123" });
    expect(result.details).toMatchObject({
      id: "msg123",
      subject: "Hello there",
      from: "alice@example.com",
      to: "bob@example.com",
      date: "Mon, 22 Feb 2026 10:00:00 +0000",
      body_text: "Plain text content",
      body_html: "",
    });
  });

  it("extracts text and html from multipart message parts", async () => {
    const cm = makeClientManager({ default: { access_token: "tok" } });
    const tool = createGmailGetTool(cm as any);

    mocks.messagesGet.mockResolvedValue({
      data: {
        id: "msg456",
        payload: {
          mimeType: "multipart/alternative",
          headers: [
            { name: "Subject", value: "Multipart" },
            { name: "From", value: "sender@example.com" },
            { name: "To", value: "recv@example.com" },
            { name: "Date", value: "Tue, 23 Feb 2026" },
          ],
          body: { data: null },
          parts: [
            { mimeType: "text/plain", body: { data: b64("Plain text") }, parts: null },
            { mimeType: "text/html", body: { data: b64("<p>HTML</p>") }, parts: null },
          ],
        },
      },
    });

    const result = await tool.execute("call-1", { id: "msg456" });
    expect(result.details.body_text).toBe("Plain text");
    expect(result.details.body_html).toBe("<p>HTML</p>");
  });

  it("traverses nested parts to find text bodies", async () => {
    const cm = makeClientManager({ default: { access_token: "tok" } });
    const tool = createGmailGetTool(cm as any);

    mocks.messagesGet.mockResolvedValue({
      data: {
        id: "msg789",
        payload: {
          mimeType: "multipart/mixed",
          headers: [
            { name: "Subject", value: "Nested" },
            { name: "From", value: "a@b.com" },
            { name: "To", value: "c@d.com" },
            { name: "Date", value: "Wed, 24 Feb 2026" },
          ],
          body: { data: null },
          parts: [
            {
              mimeType: "multipart/alternative",
              body: { data: null },
              parts: [{ mimeType: "text/plain", body: { data: b64("Nested plain") }, parts: null }],
            },
          ],
        },
      },
    });

    const result = await tool.execute("call-1", { id: "msg789" });
    expect(result.details.body_text).toBe("Nested plain");
  });
});
