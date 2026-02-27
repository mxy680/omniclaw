import { describe, it, expect, beforeAll } from "vitest";
import { XClientManager } from "../../src/auth/x-client-manager.js";
import { createXAuthTool } from "../../src/tools/x-auth-tool.js";
import { createXGetTimelineTool, createXGetUserTweetsTool } from "../../src/tools/x-timeline.js";
import { createXSearchTool } from "../../src/tools/x-search.js";
import {
  createXPostTweetTool,
  createXDeleteTweetTool,
  createXReplyTool,
} from "../../src/tools/x-tweet.js";
import {
  createXLikeTool,
  createXUnlikeTool,
  createXRetweetTool,
  createXUnretweetTool,
} from "../../src/tools/x-engagement.js";
import {
  createXGetProfileTool,
  createXFollowTool,
  createXUnfollowTool,
} from "../../src/tools/x-users.js";
import { createXGetBookmarksTool } from "../../src/tools/x-bookmarks.js";

const TOKENS_PATH =
  process.env.X_TOKENS_PATH ??
  `${process.env.HOME}/.openclaw/omniclaw-x-tokens.json`;
const ACCOUNT = "default";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config = { client_secret_path: "", x_tokens_path: TOKENS_PATH } as any;

describe("X (Twitter) Integration", () => {
  const manager = new XClientManager(TOKENS_PATH);
  const authTool = createXAuthTool(manager, config);
  const timelineTool = createXGetTimelineTool(manager);
  const userTweetsTool = createXGetUserTweetsTool(manager);
  const searchTool = createXSearchTool(manager);
  const postTweetTool = createXPostTweetTool(manager);
  const deleteTweetTool = createXDeleteTweetTool(manager);
  const replyTool = createXReplyTool(manager);
  const likeTool = createXLikeTool(manager);
  const unlikeTool = createXUnlikeTool(manager);
  const retweetTool = createXRetweetTool(manager);
  const unretweetTool = createXUnretweetTool(manager);
  const profileTool = createXGetProfileTool(manager);
  const _followTool = createXFollowTool(manager);
  const _unfollowTool = createXUnfollowTool(manager);
  const bookmarksTool = createXGetBookmarksTool(manager);

  beforeAll(async () => {
    // Always call auth — it checks for valid session first, only launches browser if needed
    const result = await authTool.execute("test", { account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);
    expect(["already_authenticated", "authenticated"]).toContain(parsed.status);
  }, 360_000);

  describe("Timeline", () => {
    it("should fetch home timeline", async () => {
      const result = await timelineTool.execute("test", {
        count: 5,
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed.tweets).toBeDefined();
      expect(Array.isArray(parsed.tweets)).toBe(true);
    });

    it("should fetch user tweets", async () => {
      const result = await userTweetsTool.execute("test", {
        screen_name: "elonmusk",
        count: 5,
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed.tweets).toBeDefined();
    });
  });

  describe("Search", () => {
    it("should search tweets", async () => {
      const result = await searchTool.execute("test", {
        query: "from:elonmusk",
        count: 5,
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed.tweets).toBeDefined();
    });
  });

  describe("Profile", () => {
    it("should get user profile", async () => {
      const result = await profileTool.execute("test", {
        screen_name: "elonmusk",
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed.screen_name).toBe("elonmusk");
      expect(parsed.followers_count).toBeGreaterThan(0);
    });
  });

  describe("Bookmarks", () => {
    it("should fetch bookmarks", async () => {
      const result = await bookmarksTool.execute("test", {
        count: 5,
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed.tweets).toBeDefined();
    });
  });

  // Write tests — opt-in via RUN_WRITE_TESTS=1
  const writeDescribe = process.env.RUN_WRITE_TESTS ? describe : describe.skip;

  writeDescribe("Write Operations", () => {
    let postedTweetId: string;

    it("should post a tweet", async () => {
      const text = `Integration test tweet — ${new Date().toISOString()} — please ignore`;
      const result = await postTweetTool.execute("test", {
        text,
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("posted");
      expect(parsed.tweet_id).toBeDefined();
      postedTweetId = parsed.tweet_id;
    });

    it("should like and unlike the posted tweet", async () => {
      expect(postedTweetId).toBeDefined();

      const likeResult = await likeTool.execute("test", {
        tweet_id: postedTweetId,
        account: ACCOUNT,
      });
      expect(JSON.parse(likeResult.content[0].text).status).toBe("liked");

      const unlikeResult = await unlikeTool.execute("test", {
        tweet_id: postedTweetId,
        account: ACCOUNT,
      });
      expect(JSON.parse(unlikeResult.content[0].text).status).toBe("unliked");
    });

    it("should retweet and unretweet", async () => {
      expect(postedTweetId).toBeDefined();

      const rtResult = await retweetTool.execute("test", {
        tweet_id: postedTweetId,
        account: ACCOUNT,
      });
      expect(JSON.parse(rtResult.content[0].text).status).toBe("retweeted");

      const unrtResult = await unretweetTool.execute("test", {
        tweet_id: postedTweetId,
        account: ACCOUNT,
      });
      expect(JSON.parse(unrtResult.content[0].text).status).toBe("unretweeted");
    });

    it("should reply to the posted tweet", async () => {
      expect(postedTweetId).toBeDefined();

      const result = await replyTool.execute("test", {
        tweet_id: postedTweetId,
        text: "Test reply — please ignore",
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("replied");
      expect(parsed.in_reply_to).toBe(postedTweetId);
    });

    it("should delete the posted tweet", async () => {
      expect(postedTweetId).toBeDefined();

      const result = await deleteTweetTool.execute("test", {
        tweet_id: postedTweetId,
        account: ACCOUNT,
      });
      expect(JSON.parse(result.content[0].text).status).toBe("deleted");
    });
  });
});
