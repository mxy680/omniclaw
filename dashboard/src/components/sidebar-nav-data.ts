import {
  LayoutDashboard,
  Activity,
  Clock,
  Server,
  MessageSquare,
  Inbox,
  Command,
  Calendar,
  Workflow,
  Settings,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Operations Feed", url: "/operations", icon: Activity },
      { title: "Timeline", url: "/timeline", icon: Clock },
    ],
  },
  {
    label: "Services",
    items: [
      { title: "Service Grid", url: "/services", icon: Server },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Chat", url: "/chat", icon: MessageSquare },
      { title: "Inbox", url: "/inbox", icon: Inbox },
      { title: "Command Palette", url: "/command", icon: Command },
    ],
  },
  {
    label: "Productivity",
    items: [
      { title: "Calendar", url: "/calendar", icon: Calendar },
      { title: "Automations", url: "/automations", icon: Workflow },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Configuration", url: "/settings", icon: Settings },
    ],
  },
];
