"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Hexagon,
  User,
  Settings,
  Wifi,
  WifiOff,
  Loader2,
  Check,
  X,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { useChat, type ChatMessage } from "@/hooks/use-chat";

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
    <div className="absolute top-0 left-0 right-0 z-10 glass rounded-xl p-4 space-y-3 mx-auto max-w-lg">
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
            className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-cyan"
            placeholder="ws://..."
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Auth Token</span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type="password"
            className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-cyan"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onSave(url, token)}
          className="h-7 bg-cyan text-background hover:bg-cyan/80 text-xs"
        >
          Save & Reconnect
        </Button>
        {isConnected ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onDisconnect}
            className="h-7 text-xs"
          >
            Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onConnect}
            className="h-7 text-xs"
          >
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
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
      {phase === "start" ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin text-cyan" />
      ) : (
        <Check className="h-2.5 w-2.5 text-emerald-400" />
      )}
      {name}
    </span>
  );
}

// ── Message bubble ─────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex items-start gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan/10 mt-0.5">
          <Hexagon className="h-4 w-4 text-cyan" />
        </div>
      )}

      <div className={`max-w-[70%] ${isUser ? "flex flex-col items-end" : ""}`}>
        {msg.toolUses.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {msg.toolUses.map((t, i) => (
              <ToolBadge key={`${t.name}-${i}`} name={t.name} phase={t.phase} />
            ))}
          </div>
        )}

        <div
          className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
            isUser ? "bg-cyan/10 text-foreground" : "glass"
          }`}
        >
          {!isUser ? (
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  return isBlock ? (
                    <pre className="my-2 overflow-x-auto rounded-md bg-black/40 p-3 text-xs">
                      <code>{children}</code>
                    </pre>
                  ) : (
                    <code className="rounded bg-white/10 px-1 py-0.5 text-xs">
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => <>{children}</>,
                ul: ({ children }) => (
                  <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-2 ml-4 list-decimal space-y-1">
                    {children}
                  </ol>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan underline underline-offset-2"
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

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary mt-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan/10 mt-0.5">
        <Hexagon className="h-4 w-4 text-cyan" />
      </div>
      <div className="glass rounded-xl px-4 py-3">
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-cyan/40 animate-pulse" />
          <span className="h-2 w-2 rounded-full bg-cyan/40 animate-pulse [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-cyan/40 animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ── Status dot ─────────────────────────────────────────────────────

function StatusDot({
  state,
  error,
  onSettingsClick,
}: {
  state: string;
  error?: string;
  onSettingsClick: () => void;
}) {
  const dotColor: Record<string, string> = {
    connected: "bg-emerald-400",
    connecting: "bg-cyan animate-pulse",
    authenticating: "bg-cyan animate-pulse",
    disconnected: "bg-yellow-400",
    error: "bg-red-400",
  };

  const label: Record<string, string> = {
    connected: "Connected",
    connecting: "Connecting...",
    authenticating: "Authenticating...",
    disconnected: "Disconnected",
    error: error ?? "Error",
  };

  return (
    <button
      onClick={onSettingsClick}
      className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor[state] ?? dotColor.error}`} />
      {label[state] ?? state}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────

export default function ChatPage() {
  const {
    messages,
    isTyping,
    connectionState,
    connectionError,
    serverUrl,
    authToken,
    isConnected,
    connect,
    disconnect,
    sendMessage,
    updateSettings,
  } = useChat();

  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !isConnected) return;

    sendMessage(text);
    setInput("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="relative flex h-[calc(100vh-6rem)] flex-col">
      {/* Settings overlay */}
      {showSettings && (
        <SettingsPanel
          serverUrl={serverUrl}
          authToken={authToken}
          isConnected={isConnected}
          onSave={(url, token) => {
            updateSettings(url, token);
            setShowSettings(false);
          }}
          onConnect={() => {
            connect();
            setShowSettings(false);
          }}
          onDisconnect={disconnect}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && !isTyping && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-2">
              <Hexagon className="h-8 w-8 text-cyan/30 mx-auto" />
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? "Send a message to start chatting."
                  : "Connecting to agent..."}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="space-y-1.5 pt-2">
        <form
          onSubmit={handleSubmit}
          className="glass rounded-xl p-3 flex gap-2 items-end"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isConnected
                ? "Message Omniclaw..."
                : "Connect to start chatting..."
            }
            rows={1}
            disabled={!isConnected}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 max-h-32 disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || !isConnected}
            className="h-8 w-8 shrink-0 bg-cyan text-background hover:bg-cyan/80 disabled:opacity-30"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>

        {/* Status line below input */}
        <div className="flex justify-center">
          <StatusDot
            state={connectionState}
            error={connectionError}
            onSettingsClick={() => setShowSettings(!showSettings)}
          />
        </div>
      </div>
    </div>
  );
}
