"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Chrome,
  Linkedin,
  Github,
  Instagram,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IntegrationCard } from "@/components/integration-card";
import { AccountRow } from "@/components/account-row";
import { ConnectDialog } from "@/components/connect-dialog";
import { RevokeDialog } from "@/components/revoke-dialog";
import type { Provider } from "@/lib/integrations";
import type { AccountInfo } from "@/lib/auth";

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

  const fetchAccounts = useCallback(async () => {
    if (!provider.available) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/accounts");
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [provider.available]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

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
        body: JSON.stringify({ account: revokeTarget }),
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
  const connected = accounts.length > 0;

  if (!provider.available) {
    return (
      <div className="space-y-6">
        <ProviderHeader provider={provider} Icon={Icon} />
        <Separator />
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Coming Soon
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {provider.name} integration is not yet available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProviderHeader provider={provider} Icon={Icon} />

      <Separator />

      {/* Connected Accounts */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connected Accounts</h2>
          <ConnectDialog
            providerName={provider.name}
            existingAccounts={accounts.map((a) => a.name)}
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading accounts...</p>
        ) : accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
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
          <Separator />

          {/* Services Grid */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Services</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {provider.services.map((service) => (
                <IntegrationCard
                  key={service.id}
                  integration={service}
                  connected={connected}
                />
              ))}
            </div>
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
          className="flex h-12 w-12 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${provider.color}15` }}
        >
          <div style={{ color: provider.color }}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      )}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {provider.name}
          </h1>
          <Badge
            variant={provider.available ? "default" : "secondary"}
            className={
              provider.available
                ? "bg-green-100 text-green-800 hover:bg-green-100"
                : ""
            }
          >
            {provider.available ? "Active" : "Coming Soon"}
          </Badge>
        </div>
        <p className="text-muted-foreground">{provider.description}</p>
      </div>
    </div>
  );
}
