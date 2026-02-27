import {
  DollarSign,
  HeartPulse,
  GraduationCap,
  FolderKanban,
  Users,
  Briefcase,
  BarChart3,
} from "lucide-react";

export type SectionStatus = "live" | "partial" | "coming-soon";

export interface SectionMetric {
  label: string;
  value: string | null;
  source?: string;
}

export interface SectionIntegration {
  id: string;
  status: "active" | "planned";
  issueNumber?: number;
}

export interface Section {
  id: string;
  title: string;
  tagline: string;
  icon: typeof HeartPulse;
  color: string;
  status: SectionStatus;
  metrics: SectionMetric[];
  integrations: SectionIntegration[];
}

export const sections: Section[] = [
  {
    id: "money",
    title: "Money",
    tagline: "Track spending, income, and investments",
    icon: DollarSign,
    color: "#22c55e",
    status: "coming-soon",
    metrics: [
      { label: "Net Worth", value: null },
      { label: "Monthly Income", value: null },
      { label: "Monthly Spending", value: null },
      { label: "Portfolio P&L", value: null },
    ],
    integrations: [
      { id: "venmo", status: "planned", issueNumber: 20 },
      { id: "boa", status: "planned", issueNumber: 21 },
      { id: "kalshi", status: "planned", issueNumber: 22 },
      { id: "shop", status: "planned", issueNumber: 23 },
    ],
  },
  {
    id: "health",
    title: "Health",
    tagline: "Nutrition, workouts, and body metrics",
    icon: HeartPulse,
    color: "#f97316",
    status: "partial",
    metrics: [
      { label: "Workout Streak", value: null },
      { label: "Sessions This Week", value: null, source: "Calendar" },
      { label: "Calories Today", value: null },
      { label: "Body Weight", value: null },
    ],
    integrations: [
      { id: "calendar", status: "active" },
      { id: "cronometer", status: "planned", issueNumber: 32 },
      { id: "factor75", status: "planned", issueNumber: 31 },
    ],
  },
  {
    id: "school",
    title: "School",
    tagline: "Courses, assignments, and grades",
    icon: GraduationCap,
    color: "#e03e2d",
    status: "live",
    metrics: [
      { label: "GPA", value: null, source: "Canvas" },
      { label: "Assignments Due", value: null, source: "Canvas" },
      { label: "Active Courses", value: null, source: "Canvas" },
      { label: "Todo Items", value: null, source: "Canvas" },
    ],
    integrations: [
      { id: "canvas", status: "active" },
      { id: "gradescope", status: "planned", issueNumber: 34 },
      { id: "overleaf", status: "planned", issueNumber: 35 },
      { id: "ratemyprofessor", status: "planned", issueNumber: 36 },
      { id: "cwru-sis", status: "planned", issueNumber: 37 },
    ],
  },
  {
    id: "projects",
    title: "Projects",
    tagline: "Repos, PRs, and developer tools",
    icon: FolderKanban,
    color: "#f0f6fc",
    status: "live",
    metrics: [
      { label: "Open PRs", value: null, source: "GitHub" },
      { label: "Commit Streak", value: null, source: "GitHub" },
      { label: "Repos", value: null, source: "GitHub" },
      { label: "Notifications", value: null, source: "GitHub" },
    ],
    integrations: [
      { id: "github", status: "active" },
      { id: "vercel", status: "planned", issueNumber: 38 },
      { id: "cloudflare", status: "planned", issueNumber: 39 },
      { id: "hetzner", status: "planned", issueNumber: 40 },
      { id: "supabase", status: "planned", issueNumber: 41 },
      { id: "npm", status: "planned", issueNumber: 42 },
      { id: "pypi", status: "planned", issueNumber: 43 },
      { id: "docker-hub", status: "planned", issueNumber: 44 },
    ],
  },
  {
    id: "social",
    title: "Social",
    tagline: "Messages, feeds, and connections",
    icon: Users,
    color: "#a855f7",
    status: "live",
    metrics: [
      { label: "Total Followers", value: null, source: "Instagram" },
      { label: "Unread DMs", value: null },
      { label: "Post Engagement", value: null },
      { label: "Platforms Connected", value: "3" },
    ],
    integrations: [
      { id: "linkedin", status: "active" },
      { id: "instagram", status: "active" },
      { id: "imessage", status: "active" },
      { id: "x", status: "planned", issueNumber: 46 },
      { id: "tiktok", status: "planned", issueNumber: 25 },
      { id: "reddit", status: "planned", issueNumber: 47 },
      { id: "discord", status: "planned", issueNumber: 26 },
      { id: "groupme", status: "planned", issueNumber: 45 },
      { id: "fb-marketplace", status: "planned", issueNumber: 27 },
    ],
  },
  {
    id: "career",
    title: "Career",
    tagline: "Jobs, networking, and professional growth",
    icon: Briefcase,
    color: "#0a66c2",
    status: "live",
    metrics: [
      { label: "Profile Views", value: null, source: "LinkedIn" },
      { label: "Connections", value: null, source: "LinkedIn" },
      { label: "Saved Jobs", value: null, source: "LinkedIn" },
      { label: "Pending Invitations", value: null, source: "LinkedIn" },
    ],
    integrations: [
      { id: "linkedin", status: "active" },
      { id: "handshake", status: "planned", issueNumber: 18 },
    ],
  },
  {
    id: "quant",
    title: "Quant",
    tagline: "Quantitative analysis and trading strategies",
    icon: BarChart3,
    color: "#06b6d4",
    status: "coming-soon",
    metrics: [
      { label: "Portfolio Value", value: null },
      { label: "Daily P&L", value: null },
      { label: "Active Strategies", value: null },
      { label: "Win Rate", value: null },
    ],
    integrations: [],
  },
];

/** Look up a section by its id. */
export function getSection(id: string): Section | undefined {
  return sections.find((s) => s.id === id);
}

/** Get all active integration IDs for a given section. */
export function getActiveIntegrationIds(sectionId: string): string[] {
  const section = getSection(sectionId);
  if (!section) return [];
  return section.integrations
    .filter((i) => i.status === "active")
    .map((i) => i.id);
}
