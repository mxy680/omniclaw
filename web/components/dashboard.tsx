"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { IntegrationCard } from "@/components/integration-card";
import { AccountRow } from "@/components/account-row";
import { ConnectDialog } from "@/components/connect-dialog";
import { RevokeDialog } from "@/components/revoke-dialog";
import { INTEGRATIONS } from "@/lib/integrations";
import type { AccountInfo } from "@/lib/auth";

export function Dashboard() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/accounts");
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

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
      // Clean URL
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

  const connected = accounts.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Omniclaw — Integration Manager
        </h1>
        <p className="text-muted-foreground">
          Manage Google Workspace authentication for MCP tools.
        </p>
      </div>

      <Separator />

      {/* Connected Accounts */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connected Accounts</h2>
          <ConnectDialog
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

      <Separator />

      {/* Integrations Grid */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {INTEGRATIONS.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              connected={connected}
            />
          ))}
        </div>
      </section>

      {/* Revoke confirmation dialog */}
      <RevokeDialog
        accountName={revokeTarget}
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
