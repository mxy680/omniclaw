"use client";

import { SectionPage } from "@/components/section-page";
import { getSection } from "@/lib/sections";

const section = getSection("money")!;

export default function SportsBettingPage() {
  return <SectionPage section={{ ...section, title: "Sports Betting" }} />;
}
