import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Credentials } from "google-auth-library";
import { createGmailSendTool, createGmailReplyTool, createGmailForwardTool } from "../src/tools/gmail-send";

// ---------------------------------------------------------------------------
// Mock googleapis
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  messagesGet: vi.fn(),
  messagesSend: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    gmail: () => ({
      users: {
        messages: { get: mocks.messagesGet, send: mocks.messagesSend },
        getProfile: mocks.getProfile,
      },
    }),
    auth: { OAuth2: class { setCredentials = vi.fn(); on = vi.fn(); } },
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

/** Decode a base64url-encoded raw email string into plain text. */
function decodeRaw(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf-8");
}

const SENDER = "sender@example.com";
const withToken = () => makeClientManager({ default: { access_token: "tok" } });

// ---------------------------------------------------------------------------
// gmail_send
// ---------------------------------------------------------------------------
describe("createGmailSendTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProfile.mockResolvedValue({ data: { emailAddress: SENDER } });
    mocks.messagesSend.mockResolvedValue({ data: { id: "sent1", threadId: "thread1" } });
  });

  it("returns auth_required when no token is stored", async () => {
    const tool = createGmailSendTool(makeClientManager() as any);
    const result = await tool.execute("c", { to: "x@x.com", subject: "Hi", body: "Hello" });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("sends email with correct headers and returns id", async () => {
    const tool = createGmailSendTool(withToken() as any);
    const result = await tool.execute("c", {
      to: "recipient@example.com",
      subject: "Test Subject",
      body: "Hello there",
    });

    expect(mocks.messagesSend).toHaveBeenCalledOnce();
    const raw = mocks.messagesSend.mock.calls[0][0].requestBody.raw as string;
    const decoded = decodeRaw(raw);
    expect(decoded).toContain("To: recipient@example.com");
    expect(decoded).toContain("Subject: Test Subject");
    expect(decoded).toContain(`From: ${SENDER}`);
    expect(decoded).toContain("Hello there");

    expect(result.details).toMatchObject({ id: "sent1", threadId: "thread1", success: true });
  });
});

// ---------------------------------------------------------------------------
// gmail_reply
// ---------------------------------------------------------------------------
describe("createGmailReplyTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProfile.mockResolvedValue({ data: { emailAddress: SENDER } });
    mocks.messagesSend.mockResolvedValue({ data: { id: "reply1", threadId: "thread42" } });
  });

  it("returns auth_required when no token is stored", async () => {
    const tool = createGmailReplyTool(makeClientManager() as any);
    const result = await tool.execute("c", { id: "msg1", body: "Reply" });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("prepends 'Re:' to the subject when not already present", async () => {
    const tool = createGmailReplyTool(withToken() as any);

    mocks.messagesGet.mockResolvedValue({
      data: {
        threadId: "thread42",
        payload: {
          headers: [
            { name: "Subject", value: "Original Subject" },
            { name: "From", value: "original@example.com" },
            { name: "Message-ID", value: "<msg-id@example.com>" },
            { name: "References", value: "" },
          ],
        },
      },
    });

    await tool.execute("c", { id: "msg1", body: "My reply" });

    const raw = mocks.messagesSend.mock.calls[0][0].requestBody.raw as string;
    const decoded = decodeRaw(raw);
    expect(decoded).toContain("Subject: Re: Original Subject");
  });

  it("does not double-add 'Re:' when already present", async () => {
    const tool = createGmailReplyTool(withToken() as any);

    mocks.messagesGet.mockResolvedValue({
      data: {
        threadId: "thread42",
        payload: {
          headers: [
            { name: "Subject", value: "Re: Already a reply" },
            { name: "From", value: "original@example.com" },
            { name: "Message-ID", value: "<msg-id@example.com>" },
            { name: "References", value: "" },
          ],
        },
      },
    });

    await tool.execute("c", { id: "msg1", body: "Another reply" });

    const raw = mocks.messagesSend.mock.calls[0][0].requestBody.raw as string;
    const decoded = decodeRaw(raw);
    expect(decoded).toContain("Subject: Re: Already a reply");
    expect(decoded).not.toContain("Subject: Re: Re:");
  });

  it("sends with the original threadId to keep the thread", async () => {
    const tool = createGmailReplyTool(withToken() as any);

    mocks.messagesGet.mockResolvedValue({
      data: {
        threadId: "thread42",
        payload: {
          headers: [
            { name: "Subject", value: "Topic" },
            { name: "From", value: "from@example.com" },
            { name: "Message-ID", value: "<original-id@example.com>" },
            { name: "References", value: "" },
          ],
        },
      },
    });

    await tool.execute("c", { id: "msg1", body: "reply body" });

    const sendArgs = mocks.messagesSend.mock.calls[0][0];
    expect(sendArgs.requestBody.threadId).toBe("thread42");
  });

  it("sets In-Reply-To and References headers", async () => {
    const tool = createGmailReplyTool(withToken() as any);

    mocks.messagesGet.mockResolvedValue({
      data: {
        threadId: "thread1",
        payload: {
          headers: [
            { name: "Subject", value: "Topic" },
            { name: "From", value: "from@example.com" },
            { name: "Message-ID", value: "<orig@example.com>" },
            { name: "References", value: "<prev@example.com>" },
          ],
        },
      },
    });

    await tool.execute("c", { id: "msg1", body: "reply" });

    const raw = mocks.messagesSend.mock.calls[0][0].requestBody.raw as string;
    const decoded = decodeRaw(raw);
    expect(decoded).toContain("In-Reply-To: <orig@example.com>");
    expect(decoded).toContain("References: <prev@example.com> <orig@example.com>");
  });
});

// ---------------------------------------------------------------------------
// gmail_forward
// ---------------------------------------------------------------------------
describe("createGmailForwardTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProfile.mockResolvedValue({ data: { emailAddress: SENDER } });
    mocks.messagesSend.mockResolvedValue({ data: { id: "fwd1", threadId: "thread99" } });
  });

  it("returns auth_required when no token is stored", async () => {
    const tool = createGmailForwardTool(makeClientManager() as any);
    const result = await tool.execute("c", { id: "msg1", to: "fwd@example.com" });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("prepends 'Fwd:' and quotes the original body", async () => {
    const tool = createGmailForwardTool(withToken() as any);

    mocks.messagesGet.mockResolvedValue({
      data: {
        payload: {
          mimeType: "text/plain",
          headers: [
            { name: "Subject", value: "Original Topic" },
            { name: "From", value: "original@example.com" },
            { name: "Date", value: "Mon, 22 Feb 2026" },
          ],
          body: { data: b64("Original message body") },
          parts: null,
        },
      },
    });

    const result = await tool.execute("c", {
      id: "msg1",
      to: "forward@example.com",
      body: "FYI",
    });

    const raw = mocks.messagesSend.mock.calls[0][0].requestBody.raw as string;
    const decoded = decodeRaw(raw);
    expect(decoded).toContain("Subject: Fwd: Original Topic");
    expect(decoded).toContain("To: forward@example.com");
    expect(decoded).toContain("---------- Forwarded message ---------");
    expect(decoded).toContain("Original message body");
    expect(decoded).toContain("FYI");

    expect(result.details).toMatchObject({ success: true });
  });
});
