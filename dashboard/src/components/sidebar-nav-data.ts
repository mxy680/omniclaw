import {
  LayoutDashboard,
  DollarSign,
  Dumbbell,
  GraduationCap,
  Code2,
  Users,
  Briefcase,
  MessageSquare,
  Activity,
  Puzzle,
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
    label: "Home",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Life",
    items: [
      { title: "Money", url: "/money", icon: DollarSign },
      { title: "Fitness", url: "/fitness", icon: Dumbbell },
      { title: "School", url: "/school", icon: GraduationCap },
      { title: "Code", url: "/code", icon: Code2 },
      { title: "Social", url: "/social", icon: Users },
      { title: "Career", url: "/career", icon: Briefcase },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Chat", url: "/chat", icon: MessageSquare },
      { title: "Operations", url: "/operations", icon: Activity },
      { title: "Integrations", url: "/integrations", icon: Puzzle },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];
