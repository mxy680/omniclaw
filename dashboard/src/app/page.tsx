"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { integrations, type Integration } from "@/lib/integrations";

export default function DashboardPage() {
  const [selected, setSelected] = useState<Integration | null>(null);

  const totalTools = integrations.reduce((sum, s) => sum + s.tools.length, 0);

  if (selected) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to integrations
        </button>

        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${selected.color}20` }}
          >
            <selected.icon
              className="h-6 w-6"
              style={{ color: selected.color }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {selected.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selected.tools.length} tools available
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {selected.tools.map((tool) => (
            <div
              key={tool.name}
              className="glass glow-cyan rounded-xl p-4 transition-colors hover:border-white/15"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold">{tool.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {tool.description}
                  </p>
                </div>
                <code className="shrink-0 rounded-md bg-white/5 px-2 py-1 text-xs text-muted-foreground font-mono">
                  {tool.name}
                </code>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {integrations.length} services &middot; {totalTools} tools active
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {integrations.map((integration) => (
          <button
            key={integration.id}
            onClick={() => setSelected(integration)}
            className="glass glow-cyan rounded-xl p-5 text-left transition-transform hover:scale-[1.02] cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${integration.color}20` }}
              >
                <integration.icon
                  className="h-5 w-5"
                  style={{ color: integration.color }}
                />
              </div>
              <Badge variant="secondary" className="text-xs font-mono">
                {integration.tools.length} tools
              </Badge>
            </div>
            <h3 className="mt-3 font-semibold">{integration.name}</h3>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
