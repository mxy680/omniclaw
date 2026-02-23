import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGmailAccountsTool } from "../src/tools/gmail-accounts";

// ---------------------------------------------------------------------------
// Mock googleapis
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    gmail: () => ({
      users: {
        getProfile: mocks.getProfile,
      },
    }),
    auth: { OAuth2: class { setCredentials = vi.fn(); on = vi.fn(); } },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeClientManager(accounts: string[] = []) {
  return {
    getClient: vi.fn().mockReturnValue({ setCredentials: vi.fn(), on: vi.fn() }),
    getRawClient: vi.fn().mockReturnValue({ setCredentials: vi.fn(), on: vi.fn() }),
    setCredentials: vi.fn(),
    listAccounts: () => accounts,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("createGmailAccountsTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty accounts array when no accounts exist", async () => {
    const tool = createGmailAccountsTool(makeClientManager() as any);
    const result = await tool.execute();
    expect(result.details).toEqual({ accounts: [] });
  });

  it("returns accounts with emails resolved from getProfile", async () => {
    mocks.getProfile
      .mockResolvedValueOnce({ data: { emailAddress: "work@example.com" } })
      .mockResolvedValueOnce({ data: { emailAddress: "personal@example.com" } });

    const tool = createGmailAccountsTool(makeClientManager(["work", "personal"]) as any);
    const result = await tool.execute();

    expect(result.details.accounts).toHaveLength(2);
    expect(result.details.accounts).toEqual(
      expect.arrayContaining([
        { account: "work", email: "work@example.com" },
        { account: "personal", email: "personal@example.com" },
      ])
    );
  });

  it("returns email: null when getProfile fails (expired token)", async () => {
    mocks.getProfile
      .mockResolvedValueOnce({ data: { emailAddress: "ok@example.com" } })
      .mockRejectedValueOnce(new Error("Token expired"));

    const tool = createGmailAccountsTool(makeClientManager(["good", "expired"]) as any);
    const result = await tool.execute();

    expect(result.details.accounts).toEqual([
      { account: "good", email: "ok@example.com" },
      { account: "expired", email: null },
    ]);
  });
});
