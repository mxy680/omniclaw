"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ProviderDetail } from "@/components/provider-detail";
import { SystemPage } from "@/components/system-page";
import { PROVIDERS } from "@/lib/integrations";

export function Dashboard() {
  const [selectedId, setSelectedId] = useState("system");

  const provider = PROVIDERS.find((p) => p.id === selectedId) ?? PROVIDERS[0];

  return (
    <div className="flex h-screen">
      <AppSidebar selectedId={selectedId} onSelect={setSelectedId} />
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
