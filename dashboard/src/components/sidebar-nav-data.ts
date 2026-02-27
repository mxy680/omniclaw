import {
  LayoutDashboard,
  DollarSign,
  Landmark,
  Trophy,
  TrendingUp,
  Receipt,
  HeartPulse,
  Apple,
  Dumbbell,
  FolderKanban,
  Users,
  Briefcase,
  MessageSquare,
  Activity,
  Puzzle,
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
      {
        title: "Money",
        url: "/money",
        icon: DollarSign,
        children: [
          { title: "Financing", url: "/money/financing", icon: Landmark },
          { title: "Sports Betting", url: "/money/sports-betting", icon: Trophy },
          { title: "Prediction Markets", url: "/money/prediction-markets", icon: TrendingUp },
          { title: "Revenue", url: "/money/revenue", icon: Receipt },
        ],
      },
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
