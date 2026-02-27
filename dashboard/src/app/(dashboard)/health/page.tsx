"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HealthPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/health/nutrition");
  }, [router]);
  return null;
}
