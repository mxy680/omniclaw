export interface Integration {
  id: string;
  name: string;
  icon: string;
  color: string;
  scope: string;
}

export const INTEGRATIONS: Integration[] = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "Mail",
    color: "#EA4335",
    scope: "https://www.googleapis.com/auth/gmail.modify",
  },
  {
    id: "calendar",
    name: "Calendar",
    icon: "Calendar",
    color: "#4285F4",
    scope: "https://www.googleapis.com/auth/calendar",
  },
  {
    id: "drive",
    name: "Drive",
    icon: "HardDrive",
    color: "#0F9D58",
    scope: "https://www.googleapis.com/auth/drive",
  },
  {
    id: "docs",
    name: "Docs",
    icon: "FileText",
    color: "#4285F4",
    scope: "https://www.googleapis.com/auth/documents",
  },
  {
    id: "sheets",
    name: "Sheets",
    icon: "Table",
    color: "#0F9D58",
    scope: "https://www.googleapis.com/auth/spreadsheets",
  },
  {
    id: "slides",
    name: "Slides",
    icon: "Presentation",
    color: "#F4B400",
    scope: "https://www.googleapis.com/auth/presentations",
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "Youtube",
    color: "#FF0000",
    scope: "https://www.googleapis.com/auth/youtube.force-ssl",
  },
];
