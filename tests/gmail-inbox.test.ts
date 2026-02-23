import type { Credentials } from "google-auth-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGmailInboxTool, createGmailSearchTool } from "../src/tools/gmail-inbox.js";

// ---------------------------------------------------------------------------
// Mock googleapis
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  messagesList: vi.fn(),
  messagesGet: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    gmail: () => ({
      users: {
        messages: {
          list: mocks.messagesList,
          get: mocks.messagesGet,
        },
      },
    }),
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

/** Build a mock messages.get response with the given header values. */
function mockGetResponse(id: string, subject: string, from: string, date: string, snippet = "") {
  return {
    data: {
      id,
      snippet,
      payload: {
        headers: [
          { name: "Subject", value: subject },
          { name: "From", value: from },
          { name: "Date", value: date },
        ],
      },
    },
  };
}

const withToken = () => makeClientManager({ default: { access_token: "tok" } });

// ---------------------------------------------------------------------------
// gmail_inbox
// ---------------------------------------------------------------------------
describe("createGmailInboxTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth_required when no token is stored", async () => {
    const tool = createGmailInboxTool(makeClientManager() as any);
    const result = await tool.execute("c", {});
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("returns an empty array when the inbox has no messages", async () => {
    const tool = createGmailInboxTool(withToken() as any);
    mocks.messagesList.mockResolvedValue({ data: { messages: [] } });

    const result = await tool.execute("c", {});
    expect(result.details).toEqual([]);
  });

  it("returns message summaries with correct fields", async () => {
    const tool = createGmailInboxTool(withToken() as any);

    mocks.messagesList.mockResolvedValue({
      data: { messages: [{ id: "a1" }, { id: "b2" }] },
    });
    mocks.messagesGet
      .mockResolvedValueOnce(
        mockGetResponse("a1", "Subject A", "alice@example.com", "Mon, 22 Feb 2026", "Snippet A"),
      )
      .mockResolvedValueOnce(
        mockGetResponse("b2", "Subject B", "bob@example.com", "Tue, 23 Feb 2026", "Snippet B"),
      );

    const result = await tool.execute("c", { max_results: 2 });
    expect(result.details).toHaveLength(2);
    expect(result.details[0]).toMatchObject({
      id: "a1",
      subject: "Subject A",
      from: "alice@example.com",
      date: "Mon, 22 Feb 2026",
      snippet: "Snippet A",
    });
    expect(result.details[1]).toMatchObject({ id: "b2", subject: "Subject B" });
  });

  it("passes max_results to the list API", async () => {
    const tool = createGmailInboxTool(withToken() as any);
    mocks.messagesList.mockResolvedValue({ data: { messages: [] } });

    await tool.execute("c", { max_results: 5 });

    expect(mocks.messagesList).toHaveBeenCalledWith(expect.objectContaining({ maxResults: 5 }));
  });
});

// ---------------------------------------------------------------------------
// gmail_search
// ---------------------------------------------------------------------------
describe("createGmailSearchTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth_required when no token is stored", async () => {
    const tool = createGmailSearchTool(makeClientManager() as any);
    const result = await tool.execute("c", { query: "is:unread" });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("passes the query string to the list API", async () => {
    const tool = createGmailSearchTool(withToken() as any);
    mocks.messagesList.mockResolvedValue({ data: { messages: [] } });

    await tool.execute("c", { query: "from:alice has:attachment" });

    expect(mocks.messagesList).toHaveBeenCalledWith(
      expect.objectContaining({ q: "from:alice has:attachment" }),
    );
  });
});
