import { Inbox } from "lucide-react";

export default function InboxPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="glass glow-cyan rounded-xl p-12 text-center">
        <Inbox className="mx-auto h-10 w-10 text-cyan" />
        <h2 className="mt-4 text-xl font-semibold">Inbox</h2>
        <p className="mt-2 text-sm text-muted-foreground">Coming soon</p>
      </div>
    </div>
  );
}
