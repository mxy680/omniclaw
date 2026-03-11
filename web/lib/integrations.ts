export interface Service {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Provider {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  available: boolean;
  services: Service[];
}

export const PROVIDERS: Provider[] = [
  {
    id: "google-workspace",
    name: "Google Workspace",
    icon: "Chrome",
    color: "#4285F4",
    description:
      "Gmail, Calendar, Drive, Docs, Sheets, Slides, and YouTube. Connect a Google account to enable all services.",
    available: true,
    services: [
      { id: "gmail", name: "Gmail", icon: "Mail", color: "#EA4335" },
      { id: "calendar", name: "Calendar", icon: "Calendar", color: "#4285F4" },
      { id: "drive", name: "Drive", icon: "HardDrive", color: "#0F9D58" },
      { id: "docs", name: "Docs", icon: "FileText", color: "#4285F4" },
      { id: "sheets", name: "Sheets", icon: "Table", color: "#0F9D58" },
      { id: "slides", name: "Slides", icon: "Presentation", color: "#F4B400" },
      { id: "youtube", name: "YouTube", icon: "Youtube", color: "#FF0000" },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "Linkedin",
    color: "#0A66C2",
    description: "Post updates, manage connections, and access LinkedIn APIs.",
    available: true,
    services: [
      { id: "linkedin", name: "LinkedIn", icon: "Linkedin", color: "#0A66C2" },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    icon: "Github",
    color: "#24292F",
    description: "Manage repositories, issues, pull requests, actions, gists, and more.",
    available: true,
    services: [
      { id: "github", name: "GitHub", icon: "Github", color: "#24292F" },
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: "Sparkles",
    color: "#4285F4",
    description:
      "Generate images with Gemini and Imagen, and videos with Veo. Requires a Gemini API key from Google AI Studio.",
    available: true,
    services: [
      { id: "gemini", name: "Gemini", icon: "Sparkles", color: "#4285F4" },
    ],
  },
  {
    id: "wolfram-alpha",
    name: "Wolfram Alpha",
    icon: "Sigma",
    color: "#DD1100",
    description: "Computational knowledge engine for math, science, conversions, data lookups, and more.",
    available: true,
    services: [
      { id: "wolfram", name: "Wolfram Alpha", icon: "Sigma", color: "#DD1100" },
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "Instagram",
    color: "#E4405F",
    description: "Publish content, manage comments, and access insights.",
    available: true,
    services: [
      { id: "instagram", name: "Instagram", icon: "Instagram", color: "#E4405F" },
    ],
  },
  {
    id: "framer",
    name: "Framer",
    icon: "Frame",
    color: "#0099FF",
    description: "Manage Framer projects, edit canvas, CMS collections, publish sites, and export to HTML.",
    available: true,
    services: [
      { id: "framer", name: "Framer", icon: "Frame", color: "#0099FF" },
    ],
  },
  {
    id: "x",
    name: "X (Twitter)",
    icon: "Twitter",
    color: "#000000",
    description: "Post tweets, search, manage timeline, bookmarks, DMs, and social connections.",
    available: true,
    services: [
      { id: "x", name: "X (Twitter)", icon: "Twitter", color: "#000000" },
    ],
  },
];

// Backward compat for IntegrationCard
export type Integration = Service;
export const INTEGRATIONS: Service[] = PROVIDERS.find(
  (p) => p.id === "google-workspace",
)!.services;
