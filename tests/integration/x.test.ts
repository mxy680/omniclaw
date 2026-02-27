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
import {
  createXGetBookmarksTool,
  createXAddBookmarkTool,
  createXRemoveBookmarkTool,
} from "../../src/tools/x-bookmarks.js";
import { createXGetTweetDetailTool } from "../../src/tools/x-tweet-detail.js";
import {
  createXMuteTool,
  createXUnmuteTool,
  createXBlockTool,
  createXUnblockTool,
  createXPinTweetTool,
  createXUnpinTweetTool,
  createXHideReplyTool,
  createXUnhideReplyTool,
} from "../../src/tools/x-moderation.js";
import {
  createXPostMediaTweetTool,
  createXQuoteTweetTool,
  createXPostThreadTool,
  createXPostPollTool,
} from "../../src/tools/x-tweet-extended.js";
import {
  createXDmInboxTool,
  createXDmConversationTool,
  createXDmSendTool,
} from "../../src/tools/x-dms.js";
import {
  createXGetListsTool,
  createXGetListTweetsTool,
  createXGetListMembersTool,
  createXCreateListTool,
  createXDeleteListTool,
  createXUpdateListTool,
  createXListAddMemberTool,
  createXListRemoveMemberTool,
} from "../../src/tools/x-lists.js";

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
  const addBookmarkTool = createXAddBookmarkTool(manager);
  const removeBookmarkTool = createXRemoveBookmarkTool(manager);
  const tweetDetailTool = createXGetTweetDetailTool(manager);
  const _muteTool = createXMuteTool(manager);
  const _unmuteTool = createXUnmuteTool(manager);
  const _blockTool = createXBlockTool(manager);
  const _unblockTool = createXUnblockTool(manager);
  const pinTweetTool = createXPinTweetTool(manager);
  const unpinTweetTool = createXUnpinTweetTool(manager);
  const _hideReplyTool = createXHideReplyTool(manager);
  const _unhideReplyTool = createXUnhideReplyTool(manager);
  const _mediaTweetTool = createXPostMediaTweetTool(manager);
  const quoteTweetTool = createXQuoteTweetTool(manager);
  const threadTool = createXPostThreadTool(manager);
  const pollTool = createXPostPollTool(manager);
  const dmInboxTool = createXDmInboxTool(manager);
  const _dmConversationTool = createXDmConversationTool(manager);
  const _dmSendTool = createXDmSendTool(manager);
  const listsTool = createXGetListsTool(manager);
  const _listTweetsTool = createXGetListTweetsTool(manager);
  const _listMembersTool = createXGetListMembersTool(manager);
  const createListTool = createXCreateListTool(manager);
  const deleteListTool = createXDeleteListTool(manager);
  const _updateListTool = createXUpdateListTool(manager);
  const _listAddMemberTool = createXListAddMemberTool(manager);
  const _listRemoveMemberTool = createXListRemoveMemberTool(manager);

  beforeAll(async () => {
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

  describe("Tweet Detail", () => {
    it("should get tweet detail", async () => {
      // Get a tweet ID from user tweets (use higher count for reliability)
      const tweetsResult = await userTweetsTool.execute("test", {
        screen_name: "elonmusk",
        count: 10,
        account: ACCOUNT,
      });
      const tweetsData = JSON.parse(tweetsResult.content[0].text);
      expect(tweetsData.tweets?.length).toBeGreaterThan(0);
      const tweetId = tweetsData.tweets[0].id;

      const result = await tweetDetailTool.execute("test", {
        tweet_id: tweetId,
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed.tweet).toBeDefined();
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

  describe("DMs", () => {
    it("should fetch DM inbox", async () => {
      const result = await dmInboxTool.execute("test", {
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      // inbox_initial_state should have conversations
      expect(parsed).toBeDefined();
    });
  });

  describe("Lists", () => {
    it("should fetch lists", async () => {
      const result = await listsTool.execute("test", {
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed).toBeDefined();
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

    it("should bookmark and unbookmark the posted tweet", async () => {
      expect(postedTweetId).toBeDefined();

      const addResult = await addBookmarkTool.execute("test", {
        tweet_id: postedTweetId,
        account: ACCOUNT,
      });
      expect(JSON.parse(addResult.content[0].text).status).toBe("bookmarked");

      const removeResult = await removeBookmarkTool.execute("test", {
        tweet_id: postedTweetId,
        account: ACCOUNT,
      });
      expect(JSON.parse(removeResult.content[0].text).status).toBe("unbookmarked");
    });

    it("should pin and unpin the posted tweet", async () => {
      expect(postedTweetId).toBeDefined();

      const pinResult = await pinTweetTool.execute("test", {
        tweet_id: postedTweetId,
        account: ACCOUNT,
      });
      expect(JSON.parse(pinResult.content[0].text).status).toBe("pinned");

      const unpinResult = await unpinTweetTool.execute("test", {
        tweet_id: postedTweetId,
        account: ACCOUNT,
      });
      expect(JSON.parse(unpinResult.content[0].text).status).toBe("unpinned");
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

    it("should quote tweet the posted tweet", async () => {
      expect(postedTweetId).toBeDefined();

      const result = await quoteTweetTool.execute("test", {
        tweet_id: postedTweetId,
        text: "Test quote — please ignore",
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("quoted");
      expect(parsed.quoted_tweet_id).toBe(postedTweetId);

      // Clean up quote tweet
      if (parsed.tweet_id) {
        await deleteTweetTool.execute("test", { tweet_id: parsed.tweet_id, account: ACCOUNT });
      }
    });

    it("should post a thread", async () => {
      const result = await threadTool.execute("test", {
        tweets: [
          `Thread test 1/2 — ${new Date().toISOString()} — please ignore`,
          `Thread test 2/2 — please ignore`,
        ],
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("thread_posted");
      expect(parsed.tweet_ids).toBeDefined();
      expect(parsed.tweet_ids.length).toBe(2);

      // Clean up thread tweets (delete in reverse order)
      for (const id of [...parsed.tweet_ids].reverse()) {
        await deleteTweetTool.execute("test", { tweet_id: id, account: ACCOUNT });
      }
    });

    it("should post a poll", async () => {
      const result = await pollTool.execute("test", {
        text: `Poll test — ${new Date().toISOString()} — please ignore`,
        choices: ["Option A", "Option B"],
        duration_minutes: 5,
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("posted_with_poll");
      expect(parsed.tweet_id).toBeDefined();

      // Clean up poll tweet
      if (parsed.tweet_id) {
        await deleteTweetTool.execute("test", { tweet_id: parsed.tweet_id, account: ACCOUNT });
      }
    });

    it("should create and delete a list", async () => {
      const result = await createListTool.execute("test", {
        name: `Test List ${Date.now()}`,
        description: "Integration test — will be deleted",
        is_private: true,
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed.status).toBe("created");

      // Try to extract list_id from the response
      const listId = parsed.list_id ?? parsed.id_str ?? parsed.id;
      if (listId) {
        const delResult = await deleteListTool.execute("test", {
          list_id: String(listId),
          account: ACCOUNT,
        });
        expect(JSON.parse(delResult.content[0].text).status).toBe("deleted");
      }
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
