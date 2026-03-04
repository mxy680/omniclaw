"use client";

import {
  Chrome,
  Linkedin,
  Github,
  Instagram,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PROVIDERS, type Provider } from "@/lib/integrations";
import { ThemeToggle } from "@/components/theme-toggle";

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
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <Image
          src="/openclaw-logo.svg"
          alt="Omniclaw"
          width={28}
          height={28}
          className="rounded-lg dark:hidden"
        />
        <Image
          src="/openclaw-logo-dark.svg"
          alt="Omniclaw"
          width={28}
          height={28}
          className="hidden rounded-lg dark:block"
        />
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          Omniclaw
        </span>
      </div>

      {/* Section label */}
      <div className="px-4 pb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
          Integrations
        </span>
      </div>

      {/* Provider list */}
      <nav className="flex-1 space-y-0.5 px-2">
        {PROVIDERS.map((provider) => (
          <SidebarItem
            key={provider.id}
            provider={provider}
            selected={selectedId === provider.id}
            onSelect={onSelect}
          />
        ))}
      </nav>

      {/* System section */}
      <div className="px-4 pb-2 pt-4">
        <span className="text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
          System
        </span>
      </div>
      <nav className="px-2 pb-2">
        <button
          onClick={() => onSelect("system")}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-150",
            selectedId === "system"
              ? "sidebar-item-active bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          <div
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              selectedId === "system" ? "bg-sidebar-primary/10" : "bg-transparent",
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
          </div>
          <span className="truncate">Status</span>
        </button>
      </nav>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-3">
        <span className="text-[11px] text-sidebar-foreground/30">v0.1.0</span>
        <ThemeToggle />
      </div>
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
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-150",
        selected
          ? "sidebar-item-active bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      {Icon && (
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
            selected ? "bg-sidebar-primary/10" : "bg-transparent",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      )}
      <span className="truncate">{provider.name}</span>
      <span
        className={cn(
          "ml-auto h-1.5 w-1.5 shrink-0 rounded-full",
          provider.available
            ? "bg-emerald-400 status-dot-active"
            : "bg-sidebar-foreground/20",
        )}
      />
    </button>
  );
}
