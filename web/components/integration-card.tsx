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
import { Badge } from "@/components/ui/badge";
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
    <Card className="relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: integration.color }}
      />
      <CardContent className="flex flex-col items-center gap-3 pt-6 pb-4">
        {Icon && (
          <div style={{ color: integration.color }}>
            <Icon className="h-8 w-8" />
          </div>
        )}
        <span className="text-sm font-medium">{integration.name}</span>
        <Badge
          variant={connected ? "default" : "secondary"}
          className={
            connected
              ? "bg-green-100 text-green-800 hover:bg-green-100"
              : ""
          }
        >
          {connected ? "Connected" : "Not connected"}
        </Badge>
      </CardContent>
    </Card>
  );
}
