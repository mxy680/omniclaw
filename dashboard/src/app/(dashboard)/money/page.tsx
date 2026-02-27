"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MoneyPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/money/financing");
  }, [router]);
  return null;
}
