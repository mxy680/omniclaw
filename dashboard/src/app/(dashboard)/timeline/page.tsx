import { Clock } from "lucide-react";

export default function TimelinePage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <Clock className="mx-auto h-8 w-8 text-muted-foreground/30" />
        <h2 className="mt-3 text-base font-medium">Timeline</h2>
        <p className="mt-1 text-sm text-muted-foreground/50">Coming soon</p>
      </div>
    </div>
  );
}
