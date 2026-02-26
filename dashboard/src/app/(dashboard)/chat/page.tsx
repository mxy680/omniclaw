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
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  useConversations,
  type ChatMessage,
} from "@/hooks/use-conversations";
import type { WsConversation } from "@/lib/websocket";

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

// ── Tool badge ─────────────────────────────────────────────────────

function ToolBadge({ name, phase }: { name: string; phase: "start" | "end" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
      {phase === "start" ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : (
        <Check className="h-2.5 w-2.5" />
      )}
      {name}
    </span>
  );
}

// ── Message bubble ─────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={isUser ? "max-w-[75%]" : "max-w-full"}>
        {msg.toolUses.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {msg.toolUses.map((t, i) => (
              <ToolBadge key={`${t.name}-${i}`} name={t.name} phase={t.phase} />
            ))}
          </div>
        )}
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
        </div>
      </div>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="px-1 py-1">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
      </div>
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
  isConnected,
  onSendMessage,
}: {
  messages: ChatMessage[];
  isTyping: boolean;
  isConnected: boolean;
  onSendMessage: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !isConnected) return;
    onSendMessage(text);
    setInput("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const hasMessages = messages.length > 0 || isTyping;

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Spacer pushes messages to bottom when few */}
        {!hasMessages && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground/30">Send a message to start chatting.</p>
          </div>
        )}
        {hasMessages && <div className="flex-1 min-h-0" />}
        <div className="max-w-2xl w-full mx-auto px-6 pb-2 space-y-5">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="max-w-2xl w-full mx-auto px-6 pb-4 pt-1">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-xl border border-border p-2.5 focus-within:border-foreground/15 transition-colors"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "Message..." : "Connecting..."}
            rows={1}
            disabled={!isConnected}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/30 max-h-32 disabled:opacity-40 px-1"
          />
          <button
            type="submit"
            disabled={!input.trim() || !isConnected}
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
            isConnected={isConnected}
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
