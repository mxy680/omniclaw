import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";
import { extractEntities } from "./linkedin-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call linkedin_auth_setup to authenticate with LinkedIn first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInConversationsTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_conversations",
    label: "LinkedIn Conversations",
    description: "List your LinkedIn message conversations. Returns conversation participants and last message preview.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        // First get the user's mailbox URN from the profile
        const meData = (await linkedinManager.get(account, "me")) as {
          included?: Array<Record<string, unknown>>;
        };
        const miniProfiles = extractEntities(meData.included, "MiniProfile");
        const myProfile = miniProfiles[0];
        const entityUrn = (myProfile?.entityUrn as string) ?? "";
        // Convert profile URN to mailbox URN: urn:li:fs_miniProfile:xxx -> urn:li:msg_mailbox:xxx
        const memberId = entityUrn.split(":").pop() ?? "";
        const mailboxUrn = encodeURIComponent(`urn:li:msg_mailbox:${memberId}`);

        const data = (await linkedinManager.get(
          account,
          "voyagerMessagingGraphQL/graphql",
          undefined,
          `queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${mailboxUrn})`,
        )) as { included?: Array<Record<string, unknown>> };

        const conversations = extractEntities(data.included, "Conversation");
        const messages = extractEntities(data.included, "Message");
        const participants = extractEntities(data.included, "MessagingMember");

        const result = conversations.map((conv) => {
          const convUrn = conv.entityUrn as string | undefined;
          // Find the last message for this conversation
          const lastMessage = messages.find((m) => {
            const mConvUrn = m.conversationUrn as string | undefined;
            return mConvUrn && convUrn && mConvUrn === convUrn;
          });

          return {
            entityUrn: convUrn,
            lastMessage: lastMessage
              ? {
                  text: (lastMessage.body as Record<string, unknown>)?.text ?? lastMessage.text,
                  sender: lastMessage.sender,
                  deliveredAt: lastMessage.deliveredAt,
                }
              : null,
            totalEventCount: conv.totalEventCount,
            unreadCount: conv.unreadCount,
          };
        });

        return jsonResult({ count: result.length, conversations: result });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInMessagesTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_messages",
    label: "LinkedIn Messages",
    description: "Get messages from a specific LinkedIn conversation. Pass the conversation URN obtained from linkedin_conversations.",
    parameters: Type.Object({
      conversation_urn: Type.String({
        description: "The conversation URN (e.g. 'urn:li:msg_conversation:...'). Get this from linkedin_conversations.",
      }),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { conversation_urn: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const conversationUrn = encodeURIComponent(params.conversation_urn);
        const data = (await linkedinManager.get(
          account,
          "voyagerMessagingGraphQL/graphql",
          undefined,
          `queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${conversationUrn})`,
        )) as { included?: Array<Record<string, unknown>> };

        const messages = extractEntities(data.included, "Message");
        const memberEntities = extractEntities(data.included, "MessagingMember");
        const miniProfiles = extractEntities(data.included, "MiniProfile");

        // Build profile lookup
        const profileMap = new Map<string, Record<string, unknown>>();
        for (const p of miniProfiles) {
          if (typeof p.entityUrn === "string") {
            profileMap.set(p.entityUrn, p);
          }
        }

        const result = messages.map((msg) => {
          const senderUrn = msg.sender as string | undefined;
          const senderProfile = senderUrn ? profileMap.get(senderUrn) : undefined;

          return {
            entityUrn: msg.entityUrn,
            text: (msg.body as Record<string, unknown>)?.text ?? msg.text,
            sender: senderProfile
              ? {
                  name: `${senderProfile.firstName ?? ""} ${senderProfile.lastName ?? ""}`.trim(),
                  publicIdentifier: senderProfile.publicIdentifier,
                }
              : { urn: senderUrn },
            deliveredAt: msg.deliveredAt,
          };
        });

        return jsonResult({ count: result.length, messages: result });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
