"use client";

import {
  Mail,
  Calendar,
  HardDrive,
  FileText,
  Table,
  Presentation,
  Youtube,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Integration } from "@/lib/integrations";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Mail,
  Calendar,
  HardDrive,
  FileText,
  Table,
  Presentation,
  Youtube,
};

interface IntegrationCardProps {
  integration: Integration;
  connected: boolean;
}

export function IntegrationCard({
  integration,
  connected,
}: IntegrationCardProps) {
  const Icon = ICON_MAP[integration.icon];

  return (
    <Card
      className="service-card relative overflow-hidden border-border/50"
      style={
        {
          "--glow-color": `${integration.color}18`,
          "--glow-border": `${integration.color}40`,
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-x-0 top-0 h-0.5 opacity-80"
        style={{ backgroundColor: integration.color }}
      />
      <CardContent className="flex flex-col items-center gap-2.5 pt-5 pb-4">
        {Icon && (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
            style={{ backgroundColor: `${integration.color}12` }}
          >
            <div style={{ color: integration.color }}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        )}
        <span className="text-[13px] font-medium">{integration.name}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? "bg-emerald-400" : "bg-muted-foreground/30"
            }`}
          />
          <span className="text-[11px] text-muted-foreground">
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
