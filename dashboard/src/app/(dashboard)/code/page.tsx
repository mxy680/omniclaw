"use client";

import { SectionPage } from "@/components/section-page";
import { getSection } from "@/lib/sections";

const section = getSection("code")!;

export default function CodePage() {
  return <SectionPage section={section} />;
}
