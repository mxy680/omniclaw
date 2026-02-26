"use client";

import { SectionPage } from "@/components/section-page";
import { getSection } from "@/lib/sections";

const section = getSection("school")!;

export default function SchoolPage() {
  return <SectionPage section={section} />;
}
