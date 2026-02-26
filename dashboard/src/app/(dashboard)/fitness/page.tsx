"use client";

import { SectionPage } from "@/components/section-page";
import { getSection } from "@/lib/sections";

const section = getSection("fitness")!;

export default function FitnessPage() {
  return <SectionPage section={section} />;
}
