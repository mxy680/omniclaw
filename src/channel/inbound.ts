import {
  createNormalizedOutboundDeliverer,
  createReplyPrefixOptions,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
  type OutboundReplyPayload,
  type OpenClawConfig,
  type RuntimeEnv,
} from "openclaw/plugin-sdk";
import type { ConversationStore } from "./conversation-store.js";
import type { ResolvedIosAccount } from "./types.js";
import type { CoreConfig } from "./types.js";
import { getChannelRuntime } from "./runtime.js";
import { sendMessageIos } from "./send.js";
import type { WsServerInstance } from "./ws-server.js";
import { resolveUploadPath } from "./upload-server.js";
import { join } from "path";
import { homedir } from "os";

const CHANNEL_ID = "omniclaw-ios" as const;

async function deliverIosReply(params: {
  payload: OutboundReplyPayload;
  connId: string;
  conversationId: string;
  store: ConversationStore;
  wsServer: WsServerInstance;
  statusSink?: (patch: { lastOutboundAt?: number }) => void;
}): Promise<void> {
  const combined = formatTextWithAttachmentLinks(
    params.payload.text,
    resolveOutboundMediaUrls(params.payload),
  );
  if (!combined) {
    return;
  }

  const { messageId } = sendMessageIos(combined, {
    connId: params.connId,
    conversationId: params.conversationId,
  });

  // Store the agent message in SQLite
  params.store.insertMessage({
    id: messageId,
    conversationId: params.conversationId,
    text: combined,
    isUser: false,
    timestamp: Date.now(),
    isStreaming: false,
  });

  // Broadcast to other connections
  params.wsServer.broadcastExcept(params.connId, {
    type: "message",
    text: combined,
    id: messageId,
    conversationId: params.conversationId,
  });

  // Notify all connections of conversation activity
  const conv = params.store.getConversation(params.conversationId);
  if (conv) {
    params.wsServer.broadcastExcept(params.connId, {
      type: "conversation_updated",
      conversation: {
        id: conv.id,
        title: conv.title,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      },
    });
  }

  params.statusSink?.({ lastOutboundAt: Date.now() });
}

export async function handleIosInbound(params: {
  text: string;
  messageId?: string;
  conversationId: string;
  connId: string;
  attachments?: Array<{ fileId: string; filename: string; mimeType: string; size?: number }>;
  account: ResolvedIosAccount;
  config: CoreConfig;
  runtime: RuntimeEnv;
  store: ConversationStore;
  wsServer: WsServerInstance;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
}): Promise<void> {
  const {
    text, connId, conversationId, account, config, runtime,
    store, wsServer, statusSink,
  } = params;
  const core = getChannelRuntime();

  const rawBody = text.trim();

  // Resolve attachment file paths
  const attachments = params.attachments ?? [];
  const mediaPaths: string[] = [];
  const mediaTypes: string[] = [];
  for (const att of attachments) {
    const path = resolveUploadPath(params.conversationId, att.fileId);
    if (path) {
      mediaPaths.push(path);
      mediaTypes.push(att.mimeType);
    }
  }
  const attachmentsJson = attachments.length > 0 ? JSON.stringify(attachments) : undefined;

  if (!rawBody && attachments.length === 0) {
    return;
  }

  const timestamp = Date.now();
  statusSink?.({ lastInboundAt: timestamp });

  // Ensure conversation exists
  if (!store.getConversation(conversationId)) {
    store.createConversation(conversationId);
  }

  // Store user message in SQLite
  const userMsgId = params.messageId ?? `ios-${timestamp}`;
  store.insertMessage({
    id: userMsgId,
    conversationId,
    text: rawBody,
    isUser: true,
    timestamp,
    attachmentsJson,
  });

  // Auto-title from first user message if conversation is still "New Chat"
  const conv = store.getConversation(conversationId);
  if (conv && conv.title === "New Chat") {
    const autoTitle = rawBody.slice(0, 40) || (attachments.length > 0 ? `${attachments[0].filename}` : "New Chat");
    store.renameConversation(conversationId, autoTitle);
    wsServer.broadcast({
      type: "conversation_renamed",
      conversationId,
      title: autoTitle,
    });
  }

  // Broadcast user message to other connections
  wsServer.broadcastExcept(connId, {
    type: "message",
    text: rawBody,
    id: userMsgId,
    conversationId,
    isUser: true,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  // Send typing indicator
  wsServer.send(connId, { type: "typing", active: true, conversationId });
  wsServer.broadcastExcept(connId, { type: "typing", active: true, conversationId });

  const peerId = `ios-${conversationId}`;
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config as OpenClawConfig,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    peer: {
      kind: "direct",
      id: peerId,
    },
  });

  // Each conversation gets its own session so the SDK can dispatch them in parallel.
  const conversationSessionKey = `${route.sessionKey}:conv:${conversationId}`;

  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config as OpenClawConfig);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: conversationSessionKey,
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "iOS",
    from: peerId,
    timestamp,
    previousTimestamp,
    envelope: envelopeOptions,
    body: rawBody,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: `omniclaw-ios:${peerId}`,
    To: `omniclaw-ios:${peerId}`,
    SessionKey: conversationSessionKey,
    AccountId: route.accountId,
    ChatType: "direct",
    ConversationLabel: "iOS App",
    SenderName: "User",
    SenderId: peerId,
    Provider: CHANNEL_ID,
    Surface: CHANNEL_ID,
    MessageSid: userMsgId,
    Timestamp: timestamp,
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: `omniclaw-ios:${peerId}`,
    CommandAuthorized: true,
    // Media attachments
    ...(mediaPaths.length > 0 && {
      MediaPaths: mediaPaths,
      MediaTypes: mediaTypes,
      MediaDir: join(homedir(), ".openclaw", "uploads", conversationId),
    }),
  });

  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err: unknown) => {
      runtime.error?.(`ios: failed updating session meta: ${String(err)}`);
    },
  });

  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg: config as OpenClawConfig,
    agentId: route.agentId,
    channel: CHANNEL_ID,
    accountId: account.accountId,
  });
  const deliverReply = createNormalizedOutboundDeliverer(async (payload) => {
    await deliverIosReply({
      payload,
      connId,
      conversationId,
      store,
      wsServer,
      statusSink,
    });
  });

  try {
    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg: config as OpenClawConfig,
      dispatcherOptions: {
        ...prefixOptions,
        deliver: deliverReply,
        onError: (err: unknown, info: { kind: string }) => {
          runtime.error?.(`ios ${info.kind} reply failed: ${String(err)}`);
          wsServer.send(connId, { type: "error", message: String(err) });
        },
      },
      replyOptions: {
        onModelSelected,
        onReasoningStream: (payload) => {
          if (payload.text) {
            wsServer.broadcast({ type: "reasoning", text: payload.text, conversationId });
          }
        },
        onPartialReply: (payload) => {
          if (payload.text) {
            wsServer.broadcast({ type: "partial_reply", text: payload.text, conversationId });
          }
        },
        onAssistantMessageStart: () => {
          wsServer.broadcast({ type: "assistant_message_start", conversationId });
        },
      },
    });
  } finally {
    // Clear typing indicator
    wsServer.send(connId, { type: "typing", active: false, conversationId });
    wsServer.broadcastExcept(connId, { type: "typing", active: false, conversationId });
  }
}
