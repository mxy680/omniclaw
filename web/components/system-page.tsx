"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  Server,
  Smartphone,
  Copy,
  Check,
  Play,
  Square,
  RotateCcw,
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
  Globe,
} from "lucide-react";
import type { TunnelStatus } from "@/lib/system-types";
import type { SystemStatus } from "@/lib/system-types";

function useSystemStatus(intervalMs = 10000) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/system/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, intervalMs);
    return () => clearInterval(id);
  }, [poll, intervalMs]);

  return { status, loading, refresh: poll };
}

export function SystemPage() {
  const { status, loading, refresh } = useSystemStatus();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (
    service: "gateway" | "mcp-server" | "mobile-ios" | "tunnel",
    action: "start" | "stop",
    extra?: Record<string, string | number>,
  ) => {
    setActionLoading(`${action}-${service}`);
    try {
      await fetch(`/api/system/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, ...extra }),
      });
      // Wait a moment then refresh
      await new Promise((r) => setTimeout(r, 1000));
      await refresh();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async (
    service: "gateway" | "mcp-server",
  ) => {
    setActionLoading(`restart-${service}`);
    try {
      await fetch("/api/system/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      });
      await new Promise((r) => setTimeout(r, 2000));
      await fetch("/api/system/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      });
      await new Promise((r) => setTimeout(r, 1000));
      await refresh();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !status) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div>
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted mt-2" />
        </div>

        {/* Service cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>

        {/* Mobile card skeleton */}
        <SkeletonCard wide />

        {/* Remote access card skeleton */}
        <SkeletonCard wide />

        <Separator />

        {/* Agents skeleton */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
            <div className="h-5 w-6 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
        </div>

        <Separator />

        {/* Diagnostics skeleton */}
        <div className="space-y-3">
          <div className="h-6 w-28 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Service status, agents, and mobile connection info.
        </p>
      </div>

      {/* Service Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ServiceCard
          title="Gateway"
          description="OpenClaw gateway (WebSocket)"
          icon={<Activity className="h-4 w-4" />}
          status={status?.gateway.status ?? "stopped"}
          port={status?.gateway.port ?? 18789}
          details={
            status?.gateway.status === "running"
              ? "Accepting connections"
              : undefined
          }
          actionLoading={actionLoading}
          service="gateway"
          onStart={() => handleAction("gateway", "start")}
          onStop={() => handleAction("gateway", "stop")}
          onRestart={() => handleRestart("gateway")}
        />
        <ServiceCard
          title="MCP Server"
          description="Tool server (HTTP)"
          icon={<Server className="h-4 w-4" />}
          status={status?.mcpServer.status ?? "stopped"}
          port={status?.mcpServer.port ?? 9850}
          details={
            status?.mcpServer.status === "running"
              ? `${status.mcpServer.tools ?? 0} tools, ${status.mcpServer.sessions ?? 0} sessions`
              : undefined
          }
          actionLoading={actionLoading}
          service="mcp-server"
          onStart={() => handleAction("mcp-server", "start")}
          onStop={() => handleAction("mcp-server", "stop")}
          onRestart={() => handleRestart("mcp-server")}
        />
      </div>

      {/* Mobile App */}
      <MobileCard
        mobile={status?.mobile}
        actionLoading={actionLoading}
        onSimulator={() =>
          handleAction("mobile-ios", "start", { target: "simulator" })
        }
        onStop={() => handleAction("mobile-ios", "stop")}
        onRestart={async () => {
          setActionLoading("restart-mobile-ios");
          try {
            await fetch("/api/system/stop", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ service: "mobile-ios" }),
            });
            await new Promise((r) => setTimeout(r, 2000));
            await fetch("/api/system/start", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ service: "mobile-ios", target: "simulator" }),
            });
            await new Promise((r) => setTimeout(r, 1000));
            await refresh();
          } catch {
            // ignore
          } finally {
            setActionLoading(null);
          }
        }}
      />

      {/* Remote Access */}
      <RemoteAccessCard
        tunnel={status?.tunnel}
        gatewayPort={status?.gateway.port ?? 18789}
        actionLoading={actionLoading}
        onStart={(port) => handleAction("tunnel", "start", { port })}
        onStop={() => handleAction("tunnel", "stop")}
      />

      <Separator />

      {/* Agents */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-medium">Agents</h2>
          <Badge variant="secondary" className="ml-1">
            {status?.agents.length ?? 0}
          </Badge>
        </div>

        {status?.agents && status.agents.length > 0 ? (
          <div className="grid gap-3">
            {status.agents.map((agent) => (
              <Card key={agent.id} className="shadow-none">
                <CardContent className="flex items-center gap-4 py-4 px-5">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      backgroundColor: agentColor(agent.colorName),
                    }}
                  >
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {agent.role}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {agent.services.map((s) => (
                      <Badge
                        key={s}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No agents configured. Add agents to ~/.openclaw/agents.json
          </p>
        )}
      </div>

      <Separator />

      {/* Diagnostics */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Diagnostics</h2>
        <div className="grid gap-2">
          <DiagnosticItem
            label="Gateway reachable"
            ok={status?.gateway.status === "running"}
          />
          <DiagnosticItem
            label="MCP server reachable"
            ok={status?.mcpServer.status === "running"}
          />
          <DiagnosticItem
            label="Agents configured"
            ok={(status?.agents.length ?? 0) > 0}
            detail={`${status?.agents.length ?? 0} agent(s)`}
          />
          <DiagnosticItem
            label="Scheduler"
            ok={status?.mcpServer.scheduler?.enabled ?? false}
            detail={
              status?.mcpServer.scheduler?.enabled
                ? `${status.mcpServer.scheduler.jobs ?? 0} jobs`
                : "disabled"
            }
          />
        </div>
      </div>
    </div>
  );
}

function ServiceCard({
  title,
  description,
  icon,
  status,
  port,
  details,
  actionLoading,
  service,
  onStart,
  onStop,
  onRestart,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "running" | "stopped" | "error";
  port: number;
  details?: string;
  actionLoading: string | null;
  service: string;
  onStart: () => void;
  onStop: () => void;
  onRestart?: () => void;
}) {
  const isStarting = actionLoading === `start-${service}`;
  const isStopping = actionLoading === `stop-${service}`;
  const isRestarting = actionLoading === `restart-${service}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <StatusDot status={status} />
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Port</span>
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {port}
          </code>
          {details && (
            <>
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">{details}</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {status === "running" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onStop}
                disabled={isStopping || isRestarting}
              >
                {isStopping ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Square className="h-3 w-3" />
                )}
                Stop
              </Button>
              {onRestart && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRestart}
                  disabled={isRestarting || isStopping}
                >
                  {isRestarting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Restart
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" onClick={onStart} disabled={isStarting}>
              {isStarting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Start
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusDot({ status, label }: { status: "running" | "stopped" | "error"; label?: string }) {
  if (status === "running") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        {label ?? "Running"}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        {label ?? "Error"}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
      {label ?? "Stopped"}
    </span>
  );
}

function DiagnosticItem({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground/50" />
      )}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
      {detail && (
        <span className="text-xs text-muted-foreground ml-auto">{detail}</span>
      )}
    </div>
  );
}

function MobileCard({
  mobile,
  actionLoading,
  onSimulator,
  onStop,
  onRestart,
}: {
  mobile?: { metro: "running" | "stopped"; metroPort: number };
  actionLoading: string | null;
  onSimulator: () => void;
  onStop: () => void;
  onRestart: () => void;
}) {
  const isLaunching = actionLoading === "start-mobile-ios";
  const isStopping = actionLoading === "stop-mobile-ios";
  const isRestarting = actionLoading === "restart-mobile-ios";
  const metroRunning = mobile?.metro === "running";
  const [building, setBuilding] = useState(false);
  const [buildLog, setBuildLog] = useState("");

  // Poll build log while building
  useEffect(() => {
    if (!building) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/system/build-log");
        const data = await res.json();
        setBuildLog(data.log || "");
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(id);
  }, [building]);

  // Clear building state when metro comes up
  useEffect(() => {
    if (metroRunning && building) {
      setBuilding(false);
      setBuildLog("");
    }
  }, [metroRunning, building]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <CardTitle className="text-base">Mobile App</CardTitle>
          </div>
          <StatusDot status={metroRunning ? "running" : "stopped"} label={metroRunning ? "Metro running" : "Metro stopped"} />
        </div>
        <CardDescription>
          Expo dev client (Metro on port {mobile?.metroPort ?? 8081})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">Simulator</span>
            <p className="text-[11px] text-muted-foreground">Run on iOS Simulator</p>
          </div>
          <div className="flex gap-2">
            {metroRunning ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onStop}
                  disabled={isStopping || isRestarting}
                >
                  {isStopping ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Square className="h-3 w-3" />
                  )}
                  Stop
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRestart}
                  disabled={isRestarting || isStopping}
                >
                  {isRestarting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Restart
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setBuilding(true);
                  setBuildLog("Starting simulator build...");
                  onSimulator();
                }}
                disabled={isLaunching || building}
              >
                {building ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                {building ? "Building..." : "Run"}
              </Button>
            )}
          </div>
        </div>
        {building && buildLog && (
          <div className="mt-3">
            <pre className="text-[11px] bg-muted rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-muted-foreground whitespace-pre-wrap">
              {buildLog}
            </pre>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 text-xs"
              onClick={() => { setBuilding(false); setBuildLog(""); }}
            >
              Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RemoteAccessCard({
  tunnel,
  gatewayPort,
  actionLoading,
  onStart,
  onStop,
}: {
  tunnel?: TunnelStatus;
  gatewayPort: number;
  actionLoading: string | null;
  onStart: (port: number) => void;
  onStop: () => void;
}) {
  const isStarting = actionLoading === "start-tunnel";
  const isStopping = actionLoading === "stop-tunnel";
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <CardTitle className="text-base">Remote Access</CardTitle>
          </div>
          <StatusDot
            status={tunnel?.running ? "running" : "stopped"}
            label={tunnel?.running ? "Tunnel active" : "Tunnel inactive"}
          />
        </div>
        <CardDescription>
          Cloudflare Tunnel — public HTTPS endpoint for the gateway
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tunnel?.running && tunnel.url ? (
          <>
            <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Public endpoint
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCopy(tunnel.url!)}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <code className="text-xs font-mono text-emerald-700 dark:text-emerald-400 break-all">
                {tunnel.url}
              </code>
              <p className="text-[11px] text-muted-foreground">
                Use this as the host in the mobile app&apos;s Settings with TLS enabled.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onStop}
              disabled={isStopping}
            >
              {isStopping ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Square className="h-3 w-3" />
              )}
              Stop Tunnel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => onStart(gatewayPort)}
            disabled={isStarting}
          >
            {isStarting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Globe className="h-3 w-3" />
            )}
            Start Tunnel
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonCard({ wide }: { wide?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-5 w-28 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-48 animate-pulse rounded bg-muted mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
          {wide && <div className="h-4 w-32 animate-pulse rounded bg-muted" />}
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

function agentColor(colorName: string): string {
  const colors: Record<string, string> = {
    red: "#ef4444",
    blue: "#3b82f6",
    green: "#22c55e",
    yellow: "#eab308",
    purple: "#a855f7",
    orange: "#f97316",
    pink: "#ec4899",
    cyan: "#06b6d4",
  };
  return colors[colorName] ?? "#6b7280";
}
