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
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
  Rocket,
  AlertTriangle,
  Globe,
} from "lucide-react";
import type { TailscaleStatus } from "@/lib/system-types";
import type { SystemStatus } from "@/lib/system-types";

function useSystemStatus(intervalMs = 5000) {
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
    service: "gateway" | "mcp-server" | "mobile-ios" | "tailscale-funnel",
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

  if (loading && !status) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Checking service status...
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading</span>
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
        />
      </div>

      {/* Mobile App */}
      <MobileCard
        mobile={status?.mobile}
        actionLoading={actionLoading}
        onLaunch={(udid) =>
          handleAction("mobile-ios", "start", udid ? { udid } : undefined)
        }
      />

      {/* Remote Access */}
      <RemoteAccessCard
        tailscale={status?.tailscale}
        gatewayPort={status?.gateway.port ?? 18789}
        actionLoading={actionLoading}
        onEnableFunnel={(port) =>
          handleAction("tailscale-funnel", "start", { port })
        }
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

      {/* Mobile Connection Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-medium">Mobile App Connection</h2>
        </div>

        <Card className="shadow-none">
          <CardContent className="py-4 px-5 space-y-4">
            <ConnectionField
              label="Gateway Address"
              value={`ws://${status?.lanIp ?? "..."}:${status?.gateway.port ?? 18789}`}
            />
            <ConnectionField
              label="Auth Token"
              value={status?.gateway.authToken ?? ""}
              masked
            />
            <p className="text-xs text-muted-foreground">
              Enter these values in the mobile app&apos;s Settings screen to
              connect.
            </p>
          </CardContent>
        </Card>
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
}) {
  const isStarting = actionLoading === `start-${service}`;
  const isStopping = actionLoading === `stop-${service}`;

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
              Stop
            </Button>
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

function ConnectionField({
  label,
  value,
  masked,
}: {
  label: string;
  value: string;
  masked?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const displayValue = masked && !revealed
    ? value.slice(0, 6) + "..." + value.slice(-4)
    : value;

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-32 shrink-0">
        {label}
      </span>
      <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono truncate">
        {displayValue}
      </code>
      {masked && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 px-2"
          onClick={() => setRevealed(!revealed)}
        >
          {revealed ? "Hide" : "Show"}
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
        {copied ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
    </div>
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
  onLaunch,
}: {
  mobile?: { metro: "running" | "stopped"; metroPort: number; devices: Array<{ name: string; osVersion: string; udid: string; modelName: string; available: boolean; error?: string }> };
  actionLoading: string | null;
  onLaunch: (udid?: string) => void;
}) {
  const isLaunching = actionLoading === "start-mobile-ios";
  const devices = mobile?.devices ?? [];
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

  const handleLaunch = (udid?: string) => {
    setBuilding(true);
    setBuildLog("Starting build...");
    onLaunch(udid);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <CardTitle className="text-base">Mobile App</CardTitle>
          </div>
          <StatusDot status={mobile?.metro === "running" ? "running" : "stopped"} label={mobile?.metro === "running" ? "Metro running" : "Metro stopped"} />
        </div>
        <CardDescription>
          Expo dev client (Metro on port {mobile?.metroPort ?? 8081})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {devices.length > 0 ? (
          <div className="space-y-2">
            {devices.map((device) => (
              <div
                key={device.udid}
                className="rounded-lg border px-3 py-2 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{device.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      iOS {device.osVersion}
                    </Badge>
                    {device.modelName && (
                      <span className="text-[10px] text-muted-foreground">{device.modelName}</span>
                    )}
                  </div>
                  {device.available ? (
                    <Button
                      size="sm"
                      onClick={() => handleLaunch(device.udid)}
                      disabled={isLaunching || building}
                    >
                      {isLaunching || building ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Rocket className="h-3 w-3" />
                      )}
                      {building ? "Building..." : "Launch"}
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] text-amber-600 dark:text-amber-400">
                      Unavailable
                    </Badge>
                  )}
                </div>
                {!device.available && device.error && (
                  <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1.5">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{device.error}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No iOS devices connected. Connect your iPhone via USB.
          </p>
        )}
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
  tailscale,
  gatewayPort,
  actionLoading,
  onEnableFunnel,
}: {
  tailscale?: TailscaleStatus;
  gatewayPort: number;
  actionLoading: string | null;
  onEnableFunnel: (port: number) => void;
}) {
  const isEnabling = actionLoading === "start-tailscale-funnel";
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!tailscale?.installed) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <CardTitle className="text-base">Remote Access</CardTitle>
          </div>
          <CardDescription>
            Install Tailscale to enable secure remote access via Funnel.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <CardTitle className="text-base">Remote Access</CardTitle>
          </div>
          <StatusDot
            status={tailscale.funnelEnabled ? "running" : "stopped"}
            label={tailscale.funnelEnabled ? "Funnel active" : "Funnel inactive"}
          />
        </div>
        <CardDescription>
          Tailscale Funnel — secure public endpoint with end-to-end TLS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tailscale.running ? (
          <>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Hostname</span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate">
                {tailscale.hostname}
              </code>
            </div>

            {tailscale.funnelEnabled && tailscale.funnelUrl ? (
              <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Public endpoint
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleCopy(tailscale.funnelUrl!)}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <code className="text-xs font-mono text-emerald-700 dark:text-emerald-400 break-all">
                  {tailscale.funnelUrl}
                </code>
                <p className="text-[11px] text-muted-foreground">
                  Paste this hostname into the mobile app&apos;s Settings with TLS enabled.
                </p>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => onEnableFunnel(gatewayPort)}
                disabled={isEnabling}
              >
                {isEnabling ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Globe className="h-3 w-3" />
                )}
                Enable Funnel
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tailscale is installed but not running. Start Tailscale to enable remote access.
          </p>
        )}
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
