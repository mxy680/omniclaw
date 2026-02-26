"use client";

import { useState, useEffect } from "react";
import {
  loadOperations,
  onOperationsUpdated,
  type StoredOperation,
} from "@/lib/operation-store";

export type { StoredOperation as Operation } from "@/lib/operation-store";

export function useOperations() {
  const [operations, setOperations] = useState<StoredOperation[]>(() =>
    loadOperations(),
  );

  useEffect(() => {
    // Listen for updates from the chat page (same tab, custom event)
    return onOperationsUpdated(() => {
      setOperations(loadOperations());
    });
  }, []);

  return { operations };
}
