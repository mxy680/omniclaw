"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hexagon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { navGroups } from "@/components/sidebar-nav-data";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <Hexagon className="h-6 w-6 text-cyan shrink-0" />
          <span className="text-lg font-bold tracking-tight text-glow group-data-[collapsible=icon]:hidden">
            Omniclaw
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-muted-foreground/60 text-xs uppercase tracking-widest">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        <p className="text-xs text-muted-foreground/50 group-data-[collapsible=icon]:hidden">
          v0.1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
