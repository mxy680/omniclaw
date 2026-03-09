"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { ProviderDetail } from "@/components/provider-detail";
import { SystemPage } from "@/components/system-page";
import { PROVIDERS } from "@/lib/integrations";

function getInitialSelectedId(): string {
  if (typeof window === "undefined") return "system";
  return localStorage.getItem("omniclaw_selected_provider") ?? "system";
}

export function Dashboard() {
  const [selectedId, setSelectedId] = useState(getInitialSelectedId);
  const searchParams = useSearchParams();

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem("omniclaw_selected_provider", id);
  }, []);

  // Handle OAuth callback search params (success/error) at the dashboard level
  // so they are always processed regardless of which view is active.
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
    } else if (error) {
      toast.error(`Authentication failed: ${error}`);
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams]);

  const provider = PROVIDERS.find((p) => p.id === selectedId) ?? PROVIDERS[0];

  return (
    <div className="flex h-screen">
      <AppSidebar selectedId={selectedId} onSelect={handleSelect} />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          {selectedId === "system" ? (
            <SystemPage />
          ) : (
            <ProviderDetail provider={provider} />
          )}
        </div>
      </main>
    </div>
  );
}
