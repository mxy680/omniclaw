"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Chrome,
  Linkedin,
  Github,
  Instagram,
  Lock,
  Play,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ServiceTestPanel, type ServiceTestPanelHandle } from "@/components/service-test-panel";
import { AccountRow } from "@/components/account-row";
import { ConnectDialog } from "@/components/connect-dialog";
import { RevokeDialog } from "@/components/revoke-dialog";
import type { Provider } from "@/lib/integrations";
import type { AccountInfo } from "@/lib/auth";

interface ServiceToolsData {
  name: string;
  tools: { name: string }[];
}

const PROVIDER_ICONS: Record<string, LucideIcon> = {
  Chrome,
  Linkedin,
  Github,
  Instagram,
};

interface ProviderDetailProps {
  provider: Provider;
}

export function ProviderDetail({ provider }: ProviderDetailProps) {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [serviceTools, setServiceTools] = useState<Record<string, ServiceToolsData>>({});
  const [toolsLoading, setToolsLoading] = useState(false);
  const [testingAllServices, setTestingAllServices] = useState(false);
  const panelRefs = useRef<Map<string, ServiceTestPanelHandle>>(new Map());

  const fetchAccounts = useCallback(async () => {
    if (!provider.available) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/accounts?provider=${encodeURIComponent(provider.id)}`);
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [provider.available, provider.id]);

  const fetchTools = useCallback(async () => {
    if (!provider.available) return;
    setToolsLoading(true);
    try {
      const res = await fetch("/api/tools");
      const data = await res.json();
      if (data.services) {
        setServiceTools(data.services);
      }
    } catch {
      // Tools are optional — don't toast on failure
    } finally {
      setToolsLoading(false);
    }
  }, [provider.available]);

  useEffect(() => {
    fetchAccounts();
    fetchTools();
  }, [fetchAccounts, fetchTools]);

  useEffect(() => {
    const success = searchParams.get("success");
    const account = searchParams.get("account");
    const email = searchParams.get("email");
    const error = searchParams.get("error");

    if (success && account) {
      toast.success(
        `Connected "${account}"${email ? ` (${email})` : ""}`,
      );
      window.history.replaceState({}, "", "/");
      fetchAccounts();
    } else if (error) {
      toast.error(`Authentication failed: ${error}`);
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams, fetchAccounts]);

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);

    try {
      const res = await fetch("/api/auth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: revokeTarget, provider: provider.id }),
      });

      if (res.ok) {
        toast.success(`Revoked "${revokeTarget}"`);
        fetchAccounts();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to revoke");
      }
    } catch {
      toast.error("Failed to revoke account");
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  }

  const Icon = PROVIDER_ICONS[provider.icon];

  if (!provider.available) {
    return (
      <div className="space-y-8">
        <ProviderHeader provider={provider} Icon={Icon} />
        <Separator className="opacity-50" />
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/50 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground/80">
              Coming Soon
            </p>
            <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
              {provider.name} integration is under development.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ProviderHeader provider={provider} Icon={Icon} />

      <Separator className="opacity-50" />

      {/* Connected Accounts */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Connected Accounts</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {accounts.length} account{accounts.length !== 1 ? "s" : ""} connected
            </p>
          </div>
          <ConnectDialog
            providerId={provider.id}
            providerName={provider.name}
            existingAccounts={accounts.map((a) => a.name)}
            onConnected={fetchAccounts}
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-muted/50"
              />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-8 text-center">
            <p className="text-[13px] text-muted-foreground">
              No accounts connected. Click &ldquo;Connect Account&rdquo; to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <AccountRow
                key={account.name}
                account={account}
                onRevoke={setRevokeTarget}
              />
            ))}
          </div>
        )}
      </section>

      {provider.services.length > 0 && (
        <>
          <Separator className="opacity-50" />

          {/* Services — Tool Testing */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Services</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {provider.services.length} services available with this integration
                </p>
              </div>
              {Object.keys(serviceTools).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={testingAllServices}
                  onClick={async () => {
                    setTestingAllServices(true);
                    for (const service of provider.services) {
                      const panel = panelRefs.current.get(service.id);
                      if (panel) await panel.testAll();
                    }
                    setTestingAllServices(false);
                  }}
                >
                  {testingAllServices ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" />
                      Test All Services
                    </>
                  )}
                </Button>
              )}
            </div>

            {toolsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-lg bg-muted/50"
                  />
                ))}
              </div>
            ) : Object.keys(serviceTools).length > 0 ? (
              <div className="space-y-2">
                {provider.services.map((service) => {
                  const data = serviceTools[service.id];
                  if (!data) return null;
                  return (
                    <ServiceTestPanel
                      key={service.id}
                      ref={(handle) => {
                        if (handle) {
                          panelRefs.current.set(service.id, handle);
                        } else {
                          panelRefs.current.delete(service.id);
                        }
                      }}
                      serviceId={service.id}
                      serviceName={data.name}
                      toolCount={data.tools.length}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/50 p-8 text-center">
                <p className="text-[13px] text-muted-foreground">
                  Run <code className="rounded bg-muted px-1.5 py-0.5 text-[12px]">pnpm build</code> first to load tool definitions.
                </p>
              </div>
            )}
          </section>
        </>
      )}

      <RevokeDialog
        accountName={revokeTarget}
        providerName={provider.name}
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        onConfirm={handleRevoke}
        loading={revoking}
      />
    </div>
  );
}

function ProviderHeader({
  provider,
  Icon,
}: {
  provider: Provider;
  Icon: LucideIcon | undefined;
}) {
  return (
    <div className="flex items-start gap-4">
      {Icon && (
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/50"
          style={{ backgroundColor: `${provider.color}10` }}
        >
          <div style={{ color: provider.color }}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      )}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight">
            {provider.name}
          </h1>
          {provider.available ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              Coming Soon
            </span>
          )}
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {provider.description}
        </p>
      </div>
    </div>
  );
}
