"use client";

import { SectionPage } from "@/components/section-page";
import { getSection } from "@/lib/sections";

const section = getSection("social")!;

export default function SocialPage() {
  return <SectionPage section={section} />;
}
