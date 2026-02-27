import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED, extractTimelineTweets } from "./x-utils.js";

const LIST_QUERY_IDS = {
  CombinedLists: "D9PUCLgRws_N4L4-PWiwOQ",
  ListLatestTweetsTimeline: "zfC9biNzR7KEplrp1U3GNw",
  ListMembers: "_LlM_o3pZHwjpBXT-d3rVg",
  CreateList: "QXil-VE8uEJPfUKFiO36Bg",
  DeleteList: "UnN9Th1BDbeLjpgjGSpL3Q",
  UpdateList: "qE2QVWL84jqa6CmH-m-D3w",
  ListAddMember: "nAi8BAjn1xQOyCH0hWZpPA",
  ListRemoveMember: "pGMiwtWRMx08r4XCYxai4Q",
  ListSubscribe: "_PBfW8RYQCUS2Zk4hGV_Cg",
  ListUnsubscribe: "Lhtvee1IbVYIRmCeLpockA",
} as const;

export function createXGetListsTool(manager: XClientManager) {
  return {
    name: "x_get_lists",
    label: "X Get Lists",
    description:
      "Get your lists on X (Twitter) — owned, subscribed, and member of.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const session = manager.getCredentials(account);
        const userId = session?.user_id;
        if (!userId) {
          return jsonResult({ error: "No user_id stored for this account. Re-run x_auth_setup." });
        }

        const data = await manager.graphqlGet(
          account,
          "CombinedLists",
          LIST_QUERY_IDS.CombinedLists,
          { userId, count: 100 },
        );
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXGetListTweetsTool(manager: XClientManager) {
  return {
    name: "x_get_list_tweets",
    label: "X Get List Tweets",
    description: "Get tweets from a specific X (Twitter) list.",
    parameters: Type.Object({
      list_id: Type.String({ description: "The ID of the list." }),
      count: Type.Optional(
        Type.Number({
          description: "Number of tweets to fetch. Defaults to 20.",
          default: 20,
        }),
      ),
      cursor: Type.Optional(
        Type.String({ description: "Pagination cursor from previous response." }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { list_id: string; count?: number; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const { list_id, count, cursor } = params;

      try {
        const data = (await manager.graphqlGet(
          account,
          "ListLatestTweetsTimeline",
          LIST_QUERY_IDS.ListLatestTweetsTimeline,
          {
            listId: list_id,
            count: count ?? 20,
            ...(cursor ? { cursor } : {}),
          },
        )) as Record<string, unknown>;

        const { tweets, cursor: nextCursor } = extractTimelineTweets(data, [
          "data",
          "list",
          "tweets_timeline",
          "timeline",
        ]);

        return jsonResult({
          list_id,
          count: tweets.length,
          tweets,
          next_cursor: nextCursor,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXGetListMembersTool(manager: XClientManager) {
  return {
    name: "x_get_list_members",
    label: "X Get List Members",
    description: "Get members of a specific X (Twitter) list.",
    parameters: Type.Object({
      list_id: Type.String({ description: "The ID of the list." }),
      count: Type.Optional(
        Type.Number({
          description: "Number of members to fetch. Defaults to 50.",
          default: 50,
        }),
      ),
      cursor: Type.Optional(
        Type.String({ description: "Pagination cursor from previous response." }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { list_id: string; count?: number; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const { list_id, count, cursor } = params;

      try {
        const data = await manager.graphqlGet(
          account,
          "ListMembers",
          LIST_QUERY_IDS.ListMembers,
          {
            listId: list_id,
            count: count ?? 50,
            ...(cursor ? { cursor } : {}),
          },
        );
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXCreateListTool(manager: XClientManager) {
  return {
    name: "x_create_list",
    label: "X Create List",
    description: "Create a new list on X (Twitter).",
    parameters: Type.Object({
      name: Type.String({ description: "Name of the new list." }),
      description: Type.Optional(
        Type.String({ description: "Description of the list." }),
      ),
      is_private: Type.Optional(
        Type.Boolean({
          description: "Whether the list is private. Defaults to false.",
          default: false,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        name: string;
        description?: string;
        is_private?: boolean;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const data = (await manager.graphqlPost(
          account,
          "CreateList",
          LIST_QUERY_IDS.CreateList,
          {
            name: params.name,
            description: params.description ?? "",
            isPrivate: params.is_private ?? false,
          },
        )) as Record<string, unknown>;

        const dataObj = data?.data as Record<string, unknown> | undefined;
        const listCreate = dataObj?.list_create as Record<string, unknown> | undefined;
        const listData = listCreate?.list ?? {};

        return jsonResult({ status: "created", ...listData as Record<string, unknown> });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXDeleteListTool(manager: XClientManager) {
  return {
    name: "x_delete_list",
    label: "X Delete List",
    description: "Delete one of your lists on X (Twitter).",
    parameters: Type.Object({
      list_id: Type.String({ description: "The ID of the list to delete." }),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { list_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        await manager.graphqlPost(
          account,
          "DeleteList",
          LIST_QUERY_IDS.DeleteList,
          { listId: params.list_id },
        );
        return jsonResult({ status: "deleted", list_id: params.list_id });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXUpdateListTool(manager: XClientManager) {
  return {
    name: "x_update_list",
    label: "X Update List",
    description:
      "Update a list's name, description, or privacy on X (Twitter).",
    parameters: Type.Object({
      list_id: Type.String({ description: "The ID of the list to update." }),
      name: Type.Optional(Type.String({ description: "New name for the list." })),
      description: Type.Optional(
        Type.String({ description: "New description for the list." }),
      ),
      is_private: Type.Optional(
        Type.Boolean({ description: "New privacy setting for the list." }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        list_id: string;
        name?: string;
        description?: string;
        is_private?: boolean;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const { list_id, name, description, is_private } = params;

      try {
        await manager.graphqlPost(
          account,
          "UpdateList",
          LIST_QUERY_IDS.UpdateList,
          {
            listId: list_id,
            ...(name !== undefined ? { name } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(is_private !== undefined ? { isPrivate: is_private } : {}),
          },
        );
        return jsonResult({ status: "updated", list_id });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXListAddMemberTool(manager: XClientManager) {
  return {
    name: "x_list_add_member",
    label: "X List Add Member",
    description: "Add a user to one of your X (Twitter) lists.",
    parameters: Type.Object({
      list_id: Type.String({ description: "The ID of the list." }),
      user_id: Type.String({ description: "The ID of the user to add." }),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { list_id: string; user_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        await manager.graphqlPost(
          account,
          "ListAddMember",
          LIST_QUERY_IDS.ListAddMember,
          { listId: params.list_id, userId: params.user_id },
        );
        return jsonResult({
          status: "added",
          list_id: params.list_id,
          user_id: params.user_id,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXListRemoveMemberTool(manager: XClientManager) {
  return {
    name: "x_list_remove_member",
    label: "X List Remove Member",
    description: "Remove a user from one of your X (Twitter) lists.",
    parameters: Type.Object({
      list_id: Type.String({ description: "The ID of the list." }),
      user_id: Type.String({ description: "The ID of the user to remove." }),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { list_id: string; user_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        await manager.graphqlPost(
          account,
          "ListRemoveMember",
          LIST_QUERY_IDS.ListRemoveMember,
          { listId: params.list_id, userId: params.user_id },
        );
        return jsonResult({
          status: "removed",
          list_id: params.list_id,
          user_id: params.user_id,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
