"use client";

import {
  Chrome,
  Linkedin,
  Github,
  Instagram,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROVIDERS, type Provider } from "@/lib/integrations";

const ICON_MAP: Record<string, LucideIcon> = {
  Chrome,
  Linkedin,
  Github,
  Instagram,
};

interface AppSidebarProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function AppSidebar({ selectedId, onSelect }: AppSidebarProps) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-4 py-5">
        <h2 className="text-sm font-semibold text-sidebar-foreground">
          Integrations
        </h2>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {PROVIDERS.map((provider) => (
          <SidebarItem
            key={provider.id}
            provider={provider}
            selected={selectedId === provider.id}
            onSelect={onSelect}
          />
        ))}
      </nav>
    </aside>
  );
}

function SidebarItem({
  provider,
  selected,
  onSelect,
}: {
  provider: Provider;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = ICON_MAP[provider.icon];

  return (
    <button
      onClick={() => onSelect(provider.id)}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        selected
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="truncate">{provider.name}</span>
      <span
        className={cn(
          "ml-auto h-2 w-2 shrink-0 rounded-full",
          provider.available ? "bg-green-500" : "bg-muted-foreground/40",
        )}
      />
    </button>
  );
}
