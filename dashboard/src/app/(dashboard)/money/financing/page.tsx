"use client";

import { SectionPage } from "@/components/section-page";
import { getSection } from "@/lib/sections";

const section = getSection("money")!;

export default function FinancingPage() {
  return <SectionPage section={{ ...section, name: "Financing" }} />;
}
