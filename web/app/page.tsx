import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";

export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="flex h-screen">
      <div className="w-60 shrink-0 border-r bg-sidebar" />
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-96 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
