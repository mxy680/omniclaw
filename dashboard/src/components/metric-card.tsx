interface MetricCardProps {
  label: string;
  value: string | null;
  source?: string;
}

export function MetricCard({ label, value, source }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card/50 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">
        {value ?? <span className="text-muted-foreground/40">&mdash;</span>}
      </p>
      {source && (
        <p className="mt-1 text-[10px] text-muted-foreground/50">
          via {source}
        </p>
      )}
    </div>
  );
}
