import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Credentials } from "google-auth-library";
import { createGmailModifyTool } from "../src/tools/gmail-modify";

// ---------------------------------------------------------------------------
// Mock googleapis
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  messagesModify: vi.fn(),
  messagesTrash: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    gmail: () => ({
      users: {
        messages: {
          modify: mocks.messagesModify,
          trash: mocks.messagesTrash,
        },
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

const withToken = () => makeClientManager({ default: { access_token: "tok" } });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("createGmailModifyTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.messagesModify.mockResolvedValue({ data: {} });
    mocks.messagesTrash.mockResolvedValue({ data: {} });
  });

  it("returns auth_required when no token is stored", async () => {
    const tool = createGmailModifyTool(makeClientManager() as any);
    const result = await tool.execute("c", { id: "msg1", action: "mark_read" });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("mark_read removes the UNREAD label", async () => {
    const tool = createGmailModifyTool(withToken() as any);
    const result = await tool.execute("c", { id: "msg1", action: "mark_read" });

    expect(mocks.messagesModify).toHaveBeenCalledWith({
      userId: "me",
      id: "msg1",
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
    expect(result.details).toMatchObject({ id: "msg1", action: "mark_read", success: true });
  });

  it("mark_unread adds the UNREAD label", async () => {
    const tool = createGmailModifyTool(withToken() as any);
    await tool.execute("c", { id: "msg1", action: "mark_unread" });

    expect(mocks.messagesModify).toHaveBeenCalledWith({
      userId: "me",
      id: "msg1",
      requestBody: { addLabelIds: ["UNREAD"] },
    });
  });

  it("archive removes the INBOX label", async () => {
    const tool = createGmailModifyTool(withToken() as any);
    await tool.execute("c", { id: "msg1", action: "archive" });

    expect(mocks.messagesModify).toHaveBeenCalledWith({
      userId: "me",
      id: "msg1",
      requestBody: { removeLabelIds: ["INBOX"] },
    });
  });

  it("trash calls messages.trash", async () => {
    const tool = createGmailModifyTool(withToken() as any);
    const result = await tool.execute("c", { id: "msg1", action: "trash" });

    expect(mocks.messagesTrash).toHaveBeenCalledWith({ userId: "me", id: "msg1" });
    expect(mocks.messagesModify).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({ id: "msg1", action: "trash", success: true });
  });
});
