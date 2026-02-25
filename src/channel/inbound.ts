import {
  createNormalizedOutboundDeliverer,
  createReplyPrefixOptions,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
  type OutboundReplyPayload,
  type OpenClawConfig,
  type RuntimeEnv,
} from "openclaw/plugin-sdk";
import type { ResolvedIosAccount } from "./types.js";
import type { CoreConfig } from "./types.js";
import { getChannelRuntime } from "./runtime.js";
import { sendMessageIos } from "./send.js";
import { getWsServer } from "./send.js";

const CHANNEL_ID = "omniclaw-ios" as const;

async function deliverIosReply(params: {
  payload: OutboundReplyPayload;
  connId: string;
  statusSink?: (patch: { lastOutboundAt?: number }) => void;
}): Promise<void> {
  const combined = formatTextWithAttachmentLinks(
    params.payload.text,
    resolveOutboundMediaUrls(params.payload),
  );
  if (!combined) {
    return;
  }

  sendMessageIos(combined, { connId: params.connId });
  params.statusSink?.({ lastOutboundAt: Date.now() });
}

export async function handleIosInbound(params: {
  text: string;
  messageId?: string;
  connId: string;
  account: ResolvedIosAccount;
  config: CoreConfig;
  runtime: RuntimeEnv;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
}): Promise<void> {
  const { text, connId, account, config, runtime, statusSink } = params;
  const core = getChannelRuntime();

  const rawBody = text.trim();
  if (!rawBody) {
    return;
  }

  const timestamp = Date.now();
  statusSink?.({ lastInboundAt: timestamp });

  // Send typing indicator
  const server = getWsServer();
  server?.send(connId, { type: "typing", active: true });

  const peerId = `ios-user`;
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config as OpenClawConfig,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    peer: {
      kind: "direct",
      id: peerId,
    },
  });

  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config as OpenClawConfig);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "iOS",
    from: "ios-user",
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
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: "direct",
    ConversationLabel: "iOS App",
    SenderName: "User",
    SenderId: peerId,
    Provider: CHANNEL_ID,
    Surface: CHANNEL_ID,
    MessageSid: params.messageId ?? `ios-${timestamp}`,
    Timestamp: timestamp,
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: `omniclaw-ios:${peerId}`,
    CommandAuthorized: true,
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
          server?.send(connId, { type: "error", message: String(err) });
        },
      },
      replyOptions: {
        onModelSelected,
      },
    });
  } finally {
    // Clear typing indicator
    server?.send(connId, { type: "typing", active: false });
  }
}
