import {
  buildBaseAccountStatusSnapshot,
  buildBaseChannelStatusSummary,
  DEFAULT_ACCOUNT_ID,
  type ChannelPlugin,
  type OpenClawConfig,
} from "openclaw/plugin-sdk";
import { listIosAccountIds, resolveIosAccount } from "./accounts.js";
import { ConversationStore } from "./conversation-store.js";
import { ProjectStore } from "./project-store.js";
import { TaskStore } from "./task-store.js";
import { DispatchManager } from "./dispatch-manager.js";
import { handleConversationMessage } from "./conversation-handlers.js";
import { handleFitnessMessage } from "./fitness-handlers.js";
import { handleProjectMessage } from "./project-handlers.js";
import { handleTaskMessage } from "./task-handlers.js";
import { handleIosInbound } from "./inbound.js";
import { getChannelRuntime } from "./runtime.js";
import { sendMessageIos, setWsServer } from "./send.js";
import type { CoreConfig, ResolvedIosAccount } from "./types.js";
import { startWsServer } from "./ws-server.js";
import { startUploadServer } from "./upload-server.js";

// Single-account design: only one iOS account is supported at a time.
// If multi-account is added, replace with Map<accountId, DispatchManager>.
let activeDispatchManager: DispatchManager | null = null;
let activeProjectStore: ProjectStore | null = null;
let activeTaskStore: TaskStore | null = null;

export function getDispatchManager(): DispatchManager | null {
  return activeDispatchManager;
}

export function getProjectStore(): ProjectStore | null {
  return activeProjectStore;
}

export function getTaskStore(): TaskStore | null {
  return activeTaskStore;
}

export const iosChannelPlugin: ChannelPlugin<ResolvedIosAccount> = {
  id: "omniclaw-ios",
  meta: {
    id: "omniclaw-ios",
    label: "iOS",
    selectionLabel: "iOS (WebSocket)",
    docsPath: "docs/ios.md",
    blurb: "iOS app channel via WebSocket",
  },
  capabilities: {
    chatTypes: ["direct"],
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.omniclaw-ios"] },
  config: {
    listAccountIds: () => listIosAccountIds(),
    resolveAccount: (cfg) => resolveIosAccount(cfg as CoreConfig),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      port: account.port,
    }),
  },
  security: {
    resolveDmPolicy: () => ({
      policy: "open",
      allowFrom: [],
      policyPath: "channels.omniclaw-ios.dmPolicy",
      allowFromPath: "channels.omniclaw-ios.allowFrom",
      approveHint: "",
    }),
  },
  messaging: {
    normalizeTarget: (input) => {
      const trimmed = input.trim().toLowerCase();
      return trimmed || undefined;
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getChannelRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 4000,
    sendText: async ({ to, text }) => {
      const result = sendMessageIos(text);
      return { channel: "omniclaw-ios", ...result, target: to };
    },
    sendMedia: async ({ to, text, mediaUrl }) => {
      const combined = mediaUrl ? `${text}\n\nAttachment: ${mediaUrl}` : text;
      const result = sendMessageIos(combined);
      return { channel: "omniclaw-ios", ...result, target: to };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ account, snapshot }) => ({
      ...buildBaseChannelStatusSummary(snapshot),
      port: account.port,
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      ...buildBaseAccountStatusSnapshot({ account, runtime }),
      port: account.port,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      if (!account.configured) {
        throw new Error(
          `iOS channel is not configured (need authToken in channels.omniclaw-ios). ` +
            `Set via: openclaw config set channels.omniclaw-ios.authToken "<token>"`,
        );
      }

      ctx.log?.info(`[ios] starting WebSocket server on port ${account.port}`);

      const cfg = ctx.cfg as CoreConfig;
      const runtime = ctx.runtime;
      const store = new ConversationStore();
      const projectStore = new ProjectStore();
      activeProjectStore = projectStore;

      const taskStore = new TaskStore();
      activeTaskStore = taskStore;

      const pluginCfg = (ctx.cfg as any)?.plugins?.entries?.omniclaw?.config ?? {};
      const dispatchManager = new DispatchManager({
        maxConcurrency: pluginCfg.dispatch_max_concurrency ?? 3,
        dispatchTimeoutMs: pluginCfg.dispatch_timeout_ms ?? 300_000,
      });
      activeDispatchManager = dispatchManager;

      const wsServer = startWsServer({
        port: account.port,
        authToken: account.authToken,
        log: (msg) => ctx.log?.info(msg),
        onReady: () => {
          setWsServer(wsServer);
          ctx.log?.info(`[ios] server ready, registered as active`);
        },
        onMessage: async (connId, msg) => {
          // Route conversation CRUD messages
          if (
            msg.type === "conversation_list" ||
            msg.type === "conversation_create" ||
            msg.type === "conversation_history" ||
            msg.type === "conversation_delete" ||
            msg.type === "conversation_rename"
          ) {
            handleConversationMessage(connId, msg, store, wsServer);
            return;
          }

          if (msg.type === "fitness_day") {
            handleFitnessMessage(connId, msg, wsServer);
            return;
          }

          // Route project messages
          if (msg.type === "project_list" || msg.type === "project_get" || msg.type === "project_delete") {
            handleProjectMessage(connId, msg, projectStore, wsServer);
            return;
          }

          // Route task messages
          if (msg.type === "task_list" || msg.type === "task_approve" || msg.type === "task_delete" || msg.type === "task_execute") {
            handleTaskMessage(connId, msg, taskStore, wsServer);
            return;
          }

          if (msg.type !== "message") {
            return;
          }
          try {
            await dispatchManager.submit({
              conversationId: msg.conversationId,
              connId,
              priority: "interactive",
              fn: () =>
                handleIosInbound({
                  text: msg.text,
                  messageId: msg.id,
                  attachments: msg.attachments,
                  conversationId: msg.conversationId,
                  connId,
                  account,
                  config: cfg,
                  runtime,
                  store,
                  wsServer,
                  statusSink: (patch) =>
                    ctx.setStatus({ accountId: ctx.accountId, ...patch }),
                }),
            });
          } catch (err) {
            ctx.log?.info(`[ios] dispatch error: ${err}`);
            wsServer.send(connId, {
              type: "error",
              message: String(err),
            });
          }
        },
      });

      const uploadServer = startUploadServer({
        port: account.port,
        authToken: account.authToken,
        log: (msg) => ctx.log?.info(msg),
      });

      ctx.setStatus({
        accountId: ctx.accountId,
        running: true,
        lastStartAt: Date.now(),
      });

      return {
        stop: () => {
          wsServer.stop();
          uploadServer.stop();
          store.close();
          projectStore.close();
          taskStore.close();
          activeDispatchManager = null;
          activeProjectStore = null;
          activeTaskStore = null;
          setWsServer(null as unknown as ReturnType<typeof startWsServer>);
          ctx.setStatus({
            accountId: ctx.accountId,
            running: false,
            lastStopAt: Date.now(),
          });
        },
      };
    },
  },
};
