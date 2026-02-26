"use client";

import { SectionPage } from "@/components/section-page";
import { getSection } from "@/lib/sections";

const section = getSection("money")!;

export default function MoneyPage() {
  return <SectionPage section={section} />;
}
