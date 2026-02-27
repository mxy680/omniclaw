import {
  LayoutDashboard,
  DollarSign,
  HeartPulse,
  Apple,
  Dumbbell,
  FolderKanban,
  Users,
  Briefcase,
  MessageSquare,
  Activity,
  Puzzle,
  BarChart3,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  children?: NavItem[];
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
      {
        title: "Health",
        url: "/health",
        icon: HeartPulse,
        children: [
          { title: "Nutrition", url: "/health/nutrition", icon: Apple },
          { title: "Fitness", url: "/health/fitness", icon: Dumbbell },
        ],
      },
      { title: "Projects", url: "/projects", icon: FolderKanban },
      { title: "Social", url: "/social", icon: Users },
      { title: "Career", url: "/career", icon: Briefcase },
      { title: "Quant", url: "/quant", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Chat", url: "/chat", icon: MessageSquare },
      { title: "Operations", url: "/operations", icon: Activity },
      { title: "Integrations", url: "/integrations", icon: Puzzle },
    ],
  },
];
