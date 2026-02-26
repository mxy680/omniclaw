"use client";

import { SectionPage } from "@/components/section-page";
import { getSection } from "@/lib/sections";

const section = getSection("career")!;

export default function CareerPage() {
  return <SectionPage section={section} />;
}
