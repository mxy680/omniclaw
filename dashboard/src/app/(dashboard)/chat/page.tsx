"use client";

import { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  Loader2,
  Check,
  X,
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
  Circle,
  Settings2,
  ChevronDown,
  Terminal,
  Paperclip,
  FileText,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  useConversations,
  type ChatMessage,
  type ToolUse,
} from "@/hooks/use-conversations";
import type { WsConversation } from "@/lib/websocket";
import {
  findIntegrationForTool,
  findToolByName,
} from "@/lib/integrations";
import { useFileUpload } from "@/hooks/use-file-upload";
import type { WsAttachment } from "@/lib/websocket";

// ── Settings panel ─────────────────────────────────────────────────

function SettingsPanel({
  serverUrl,
  authToken,
  isConnected,
  onSave,
  onConnect,
  onDisconnect,
  onClose,
}: {
  serverUrl: string;
  authToken: string;
  isConnected: boolean;
  onSave: (url: string, token: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(serverUrl);
  const [token, setToken] = useState(authToken);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-md rounded-lg border border-border bg-card p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Connection Settings
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        <label className="block">
          <span className="text-xs text-muted-foreground">Server URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-xs outline-none focus:border-foreground/20"
            placeholder="ws://..."
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Auth Token</span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type="password"
            className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-xs outline-none focus:border-foreground/20"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onSave(url, token)}
          className="h-7 bg-foreground text-background hover:bg-foreground/80 text-xs"
        >
          Save & Reconnect
        </Button>
        {isConnected ? (
          <Button size="sm" variant="outline" onClick={onDisconnect} className="h-7 text-xs">
            Disconnect
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onConnect} className="h-7 text-xs">
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Format duration ─────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Elapsed timer hook ──────────────────────────────────────────────

function useElapsed(startedAt?: number, active?: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active || !startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [active, startedAt]);
  if (!startedAt) return null;
  if (!active) return null;
  return now - startedAt;
}

// ── Tool detail dialog ──────────────────────────────────────────────

function ToolDetailDialog({
  tool,
  onClose,
}: {
  tool: ToolUse;
  onClose: () => void;
}) {
  const isActive = tool.phase === "start";
  const elapsed = useElapsed(tool.startedAt, isActive);
  const integration = findIntegrationForTool(tool.name);
  const toolInfo = findToolByName(tool.name);
  const Icon = integration?.icon ?? Terminal;
  const color = integration?.color ?? "#888";
  const hasParams = tool.params && Object.keys(tool.params).length > 0;
  const hasResult = !!tool.result;

  // Close on Escape key & lock body scroll
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[80vh] rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}20` }}
            >
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">{toolInfo?.label ?? tool.name}</span>
              <div className="flex items-center gap-2 mt-0.5">
                {integration && (
                  <span className="text-[11px] text-muted-foreground/60">{integration.name}</span>
                )}
                {integration && <span className="text-[11px] text-muted-foreground/20">·</span>}
                {isActive ? (
                  <span className="text-[11px] text-blue-400">
                    Running{elapsed != null ? ` · ${formatDuration(elapsed)}` : "..."}
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-400/80">
                    Completed{tool.durationMs != null ? ` · ${formatDuration(tool.durationMs)}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-foreground/5 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-4.5rem)]">
          {/* Description */}
          {toolInfo?.description && (
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs text-muted-foreground/60 leading-relaxed">{toolInfo.description}</p>
            </div>
          )}

          {/* Parameters */}
          {hasParams && (
            <div className="px-5 pt-3 pb-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Parameters</span>
              <pre className="mt-2 rounded-lg bg-black/30 border border-border/50 p-3 text-xs text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
                {JSON.stringify(tool.params, null, 2)}
              </pre>
            </div>
          )}

          {/* Result */}
          {hasResult && (
            <div className="px-5 pt-3 pb-4 border-t border-border/50">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Result</span>
              <pre className="mt-2 rounded-lg bg-black/30 border border-border/50 p-3 text-xs text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all max-h-72 overflow-y-auto font-mono leading-relaxed">
                {tool.result}
              </pre>
            </div>
          )}

          {/* Running state */}
          {!hasParams && !hasResult && isActive && (
            <div className="px-5 py-6 flex items-center justify-center gap-2 text-xs text-muted-foreground/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Executing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tool card ───────────────────────────────────────────────────────

function ToolCard({ tool }: { tool: ToolUse }) {
  const [showDetail, setShowDetail] = useState(false);
  const isActive = tool.phase === "start";
  const elapsed = useElapsed(tool.startedAt, isActive);
  const integration = findIntegrationForTool(tool.name);
  const toolInfo = findToolByName(tool.name);
  const Icon = integration?.icon ?? Terminal;
  const color = integration?.color ?? "#888";

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className={`group flex items-center gap-3 w-full h-[56px] rounded-xl border-l-2 border px-3.5 text-left transition-all cursor-pointer animate-in fade-in slide-in-from-left-2 duration-200 ${
          isActive
            ? "border-border/30 bg-blue-500/[0.03] hover:bg-blue-500/[0.06]"
            : "border-border/30 bg-foreground/[0.015] hover:bg-foreground/[0.04]"
        }`}
        style={{ borderLeftColor: isActive ? "#3b82f6a0" : `${color}90` }}
      >
        {/* Integration logo */}
        <div
          className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color }} />
        </div>

        {/* Two-line content */}
        <div className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-foreground truncate leading-tight">
            {toolInfo?.label ?? tool.name}
          </span>
          <span className="block text-[10px] text-muted-foreground/40 truncate leading-tight mt-0.5">
            {integration ? integration.name : "Tool"}
            {toolInfo?.description && ` · ${toolInfo.description}`}
          </span>
        </div>

        {/* Status + timing */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {isActive ? (
            <>
              <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
              {elapsed != null && (
                <span className="text-[10px] text-blue-400/60 tabular-nums leading-none">{formatDuration(elapsed)}</span>
              )}
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400/80" />
              {tool.durationMs != null && (
                <span className="text-[10px] text-muted-foreground/30 tabular-nums leading-none">{formatDuration(tool.durationMs)}</span>
              )}
            </>
          )}
        </div>
      </button>
      {showDetail && <ToolDetailDialog tool={tool} onClose={() => setShowDetail(false)} />}
    </>
  );
}

// ── Tool card list ──────────────────────────────────────────────────

function ToolCardList({ tools }: { tools: ToolUse[] }) {
  if (tools.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 mb-3 max-w-md">
      {tools.map((t, i) => (
        <ToolCard key={`${t.name}-${i}`} tool={t} />
      ))}
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────

function MessageBubble({ msg, activeConversationId, serverUrl, authToken }: { msg: ChatMessage; activeConversationId: string; serverUrl: string; authToken: string }) {
  const isUser = msg.role === "user";

  function fileUrl(fileId: string) {
    try {
      const wsUrl = new URL(serverUrl);
      const protocol = wsUrl.protocol === "wss:" ? "https:" : "http:";
      const port = parseInt(wsUrl.port || "9600", 10) + 1;
      return `${protocol}//${wsUrl.hostname}:${port}/uploads/${activeConversationId}/${fileId}?token=${encodeURIComponent(authToken)}`;
    } catch { return ""; }
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={isUser ? "max-w-[75%]" : "max-w-full"}>
        <ToolCardList tools={msg.toolUses} />
        <div
          className={`text-sm leading-relaxed ${
            isUser
              ? "rounded-2xl rounded-br-md bg-foreground/10 px-4 py-2.5"
              : "px-1"
          }`}
        >
          {!isUser ? (
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  return isBlock ? (
                    <pre className="my-2 overflow-x-auto rounded-md bg-white/5 p-3 text-xs">
                      <code>{children}</code>
                    </pre>
                  ) : (
                    <code className="rounded bg-white/10 px-1 py-0.5 text-xs">{children}</code>
                  );
                },
                pre: ({ children }) => <>{children}</>,
                ul: ({ children }) => (
                  <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 decoration-muted-foreground/40"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {msg.content}
            </Markdown>
          ) : (
            msg.content
          )}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className={`flex flex-wrap gap-2 ${msg.content ? "mt-2" : ""}`}>
              {msg.attachments.map((att, i) => {
                const isImage = att.mimeType.startsWith("image/");
                if (isImage) {
                  const url = att.url ?? fileUrl(att.fileId);
                  return (
                    <img
                      key={i}
                      src={url}
                      alt={att.filename}
                      className="max-h-48 max-w-64 rounded-lg object-cover border border-border"
                    />
                  );
                }
                return (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-border px-2 py-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[150px]">{att.filename}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reasoning block ─────────────────────────────────────────────────

function ReasoningBlock({ text }: { text: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [text, collapsed]);

  return (
    <div className="rounded-lg bg-muted/30 border border-border/50 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Thinking...</span>
        <ChevronDown
          className={`h-3 w-3 ml-auto transition-transform ${collapsed ? "-rotate-90" : ""}`}
        />
      </button>
      {!collapsed && (
        <div className="px-3 pb-2 text-xs text-muted-foreground/70 max-h-40 overflow-y-auto whitespace-pre-wrap">
          {text}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

// ── Activity indicator ──────────────────────────────────────────────

function ActivityIndicator({
  reasoning,
  partialReply,
  toolUses,
}: {
  reasoning: string;
  partialReply: string;
  toolUses: ToolUse[];
}) {
  const hasReasoning = reasoning.length > 0;
  const hasPartialReply = partialReply.length > 0;
  const hasTools = toolUses.length > 0;
  const allToolsDone = hasTools && toolUses.every((t) => t.phase === "end");
  const anyToolActive = hasTools && toolUses.some((t) => t.phase === "start");

  // Show tool cards
  const toolCards = hasTools && <ToolCardList tools={toolUses} />;

  // Show reasoning block
  const reasoningBlock = hasReasoning && <ReasoningBlock text={reasoning} />;

  // Show partial reply as streaming markdown
  const partialBlock = hasPartialReply && (
    <div className="px-1 text-sm leading-relaxed">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            return isBlock ? (
              <pre className="my-2 overflow-x-auto rounded-md bg-white/5 p-3 text-xs">
                <code>{children}</code>
              </pre>
            ) : (
              <code className="rounded bg-white/10 px-1 py-0.5 text-xs">{children}</code>
            );
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {partialReply}
      </Markdown>
    </div>
  );

  // "Thinking..." label: show when no data yet OR tools done but no reply started
  const showThinking = (!hasReasoning && !hasPartialReply && !hasTools) ||
    (allToolsDone && !hasPartialReply && !hasReasoning);
  const thinkingLabel = showThinking && (
    <div className="flex items-center gap-2 rounded-lg bg-muted/20 border border-border/30 px-3 py-2 max-w-[200px] animate-in fade-in duration-300">
      <Loader2 className="h-3.5 w-3.5 text-muted-foreground/50 animate-spin shrink-0" />
      <span className="text-xs text-muted-foreground/50">
        {allToolsDone ? "Composing reply..." : "Thinking..."}
      </span>
    </div>
  );

  return (
    <div className="space-y-2">
      {toolCards}
      {reasoningBlock}
      {partialBlock}
      {thinkingLabel}
    </div>
  );
}

// ── Conversation sidebar ────────────────────────────────────────────

function ConversationSidebar({
  conversations,
  activeId,
  typingMap,
  connectionState,
  connectionError,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  onSettingsClick,
}: {
  conversations: WsConversation[];
  activeId: string | null;
  typingMap: Record<string, boolean>;
  connectionState: string;
  connectionError?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onSettingsClick: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chats</span>
        <button
          onClick={onCreate}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="New chat"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {conversations.length === 0 && (
          <div className="px-3 py-10 text-center text-xs text-muted-foreground/40">
            No conversations
          </div>
        )}
        {conversations.map((conv) => (
          <ConversationRow
            key={conv.id}
            conversation={conv}
            isActive={conv.id === activeId}
            isTyping={!!typingMap[conv.id]}
            onSelect={() => onSelect(conv.id)}
            onDelete={() => onDelete(conv.id)}
            onRename={(title) => onRename(conv.id, title)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border flex items-center justify-between">
        <StatusIndicator state={connectionState} error={connectionError} />
        <button
          onClick={onSettingsClick}
          className="text-muted-foreground/40 hover:text-foreground transition-colors"
          title="Connection settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Status indicator ────────────────────────────────────────────────

function StatusIndicator({ state, error }: { state: string; error?: string }) {
  const colors: Record<string, string> = {
    connected: "text-emerald-500",
    connecting: "text-muted-foreground animate-pulse",
    authenticating: "text-muted-foreground animate-pulse",
    disconnected: "text-yellow-500",
    error: "text-red-400",
  };
  const labels: Record<string, string> = {
    connected: "Connected",
    connecting: "Connecting...",
    authenticating: "Authenticating...",
    disconnected: "Disconnected",
    error: error ?? "Error",
  };

  return (
    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
      <Circle className={`h-1.5 w-1.5 fill-current ${colors[state] ?? colors.error}`} />
      {labels[state] ?? state}
    </span>
  );
}

// ── Conversation row ────────────────────────────────────────────────

function ConversationRow({
  conversation,
  isActive,
  isTyping,
  onSelect,
  onDelete,
  onRename,
}: {
  conversation: WsConversation;
  isActive: boolean;
  isTyping: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);

  function handleRenameSubmit() {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(trimmed);
    }
    setEditing(false);
  }

  return (
    <div
      className={`group flex items-center gap-2 mx-1.5 px-2 py-2 rounded-md cursor-pointer transition-colors ${
        isActive ? "bg-foreground/10" : "hover:bg-foreground/[0.04]"
      }`}
      onClick={() => { if (!editing) onSelect(); }}
    >
      {isTyping ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 animate-spin" />
      ) : (
        <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-foreground/50" : "text-muted-foreground/30"}`} />
      )}
      {editing ? (
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
          className="flex-1 bg-transparent text-xs outline-none border-b border-muted-foreground/20"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className={`flex-1 text-xs truncate ${isActive ? "text-foreground" : "text-foreground/60"}`}>
          {conversation.title}
        </span>
      )}
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setEditTitle(conversation.title); setEditing(true); }}
          className="p-0.5 text-muted-foreground/40 hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 text-muted-foreground/40 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Chat detail ─────────────────────────────────────────────────────

function ChatDetail({
  messages,
  isTyping,
  reasoning,
  partialReply,
  activeTools,
  isConnected,
  serverUrl,
  authToken,
  activeConversationId,
  onSendMessage,
}: {
  messages: ChatMessage[];
  isTyping: boolean;
  reasoning: string;
  partialReply: string;
  activeTools: ToolUse[];
  isConnected: boolean;
  serverUrl: string;
  authToken: string;
  activeConversationId: string;
  onSendMessage: (text: string, attachments?: WsAttachment[]) => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { pendingFiles, addFiles, removeFile, uploadAll, clear: clearFiles, hasPending } =
    useFileUpload(serverUrl, authToken);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if ((!text && !hasPending) || !isConnected) return;

    let attachments: WsAttachment[] | undefined;
    if (hasPending) {
      const uploaded = await uploadAll(activeConversationId);
      if (uploaded.length > 0) {
        attachments = uploaded;
      }
      if (!text && (!attachments || attachments.length === 0)) return;
    }

    onSendMessage(text, attachments);
    setInput("");
    clearFiles();
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      addFiles(files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  const hasMessages = messages.length > 0 || isTyping;

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto flex flex-col relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 border-2 border-dashed border-foreground/20 rounded-xl m-2">
            <p className="text-muted-foreground text-sm">Drop files here</p>
          </div>
        )}
        {/* Spacer pushes messages to bottom when few */}
        {!hasMessages && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground/30">Send a message to start chatting.</p>
          </div>
        )}
        {hasMessages && <div className="flex-1 min-h-0" />}
        <div className="max-w-2xl w-full mx-auto px-6 pb-2 space-y-5">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} activeConversationId={activeConversationId} serverUrl={serverUrl} authToken={authToken} />
          ))}
          {isTyping && (
            <ActivityIndicator
              reasoning={reasoning}
              partialReply={partialReply}
              toolUses={activeTools}
            />
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Pending files staging area */}
      {hasPending && (
        <div className="max-w-2xl w-full mx-auto px-6">
          <div className="flex flex-wrap gap-2 p-2 rounded-t-xl border border-b-0 border-border bg-card/50">
            {pendingFiles.map((pf, i) => (
              <div key={i} className="relative group flex items-center gap-1.5 rounded-lg bg-white/5 border border-border px-2 py-1.5 text-xs">
                {pf.preview ? (
                  <img src={pf.preview} alt="" className="h-8 w-8 rounded object-cover" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="max-w-[120px] truncate text-muted-foreground">
                  {pf.file.name}
                </span>
                {pf.uploading && (
                  <span className="text-blue-400 animate-pulse">...</span>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="max-w-2xl w-full mx-auto px-6 pb-4 pt-1">
        <form
          onSubmit={handleSubmit}
          className={`flex items-end gap-2 ${hasPending ? "rounded-b-xl rounded-t-none border-t-0" : "rounded-xl"} border border-border p-2.5 focus-within:border-foreground/15 transition-colors`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*/*"
            className="absolute w-0 h-0 opacity-0 overflow-hidden pointer-events-none"
            tabIndex={-1}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={!isConnected}
            className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-15 transition-all cursor-pointer"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isConnected ? "Message..." : "Connecting..."}
            rows={1}
            disabled={!isConnected}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/30 max-h-32 disabled:opacity-40 px-1"
          />
          <button
            type="submit"
            disabled={(!input.trim() && !hasPending) || !isConnected}
            className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg bg-foreground text-background disabled:opacity-15 transition-opacity"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────

export default function ChatPage() {
  const {
    conversations,
    activeConversationId,
    messages,
    isTyping,
    reasoning,
    partialReply,
    activeTools,
    connectionState,
    connectionError,
    serverUrl,
    authToken,
    isConnected,
    connect,
    disconnect,
    selectConversation,
    sendMessage,
    createConversation,
    deleteConversation,
    renameConversation,
    updateSettings,
    typingMap,
  } = useConversations();

  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="relative flex h-[calc(100vh-6rem)]">
      {showSettings && (
        <SettingsPanel
          serverUrl={serverUrl}
          authToken={authToken}
          isConnected={isConnected}
          onSave={(url, token) => { updateSettings(url, token); setShowSettings(false); }}
          onConnect={() => { connect(); setShowSettings(false); }}
          onDisconnect={disconnect}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Sidebar */}
      <div className="w-[240px] shrink-0 border-r border-border flex flex-col">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          typingMap={typingMap}
          connectionState={connectionState}
          connectionError={connectionError}
          onSelect={selectConversation}
          onCreate={() => createConversation()}
          onDelete={deleteConversation}
          onRename={renameConversation}
          onSettingsClick={() => setShowSettings(!showSettings)}
        />
      </div>

      {/* Detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConversationId ? (
          <ChatDetail
            messages={messages}
            isTyping={isTyping}
            reasoning={reasoning}
            partialReply={partialReply}
            activeTools={activeTools}
            isConnected={isConnected}
            serverUrl={serverUrl}
            authToken={authToken}
            activeConversationId={activeConversationId}
            onSendMessage={sendMessage}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground/30">
              {isConnected ? "Select a conversation or create a new one." : "Connecting to agent..."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
