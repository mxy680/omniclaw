"use client";

import { useState } from "react";
import {
  Loader2,
  Check,
  X,
  Play,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ToolStatus = "idle" | "running" | "success" | "error";

interface ToolInfo {
  name: string;
  label: string;
  description: string;
}

interface ToolRowProps {
  tool: ToolInfo;
  status: ToolStatus;
  duration?: number;
  error?: string;
  result?: unknown;
  onTest: () => void;
}

export function ToolRow({
  tool,
  status,
  duration,
  error,
  result,
  onTest,
}: ToolRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group">
      <div className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50">
        {/* Status indicator */}
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          {status === "idle" && (
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
          )}
          {status === "running" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {status === "success" && (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          )}
          {status === "error" && (
            <X className="h-3.5 w-3.5 text-red-500" />
          )}
        </div>

        {/* Tool info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <code className="text-[12px] font-medium text-foreground/90">
              {tool.name}
            </code>
            {status === "success" && duration !== undefined && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                {duration}ms
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {tool.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {status === "success" && result !== undefined && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onTest}
            disabled={status === "running"}
          >
            {status === "running" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Test
          </Button>
        </div>
      </div>

      {/* Error message */}
      {status === "error" && error && (
        <div className="ml-11 mr-3 mb-1 rounded-md bg-red-500/10 px-3 py-1.5">
          <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Expandable result */}
      {expanded && result !== undefined && (
        <div className="ml-11 mr-3 mb-1 overflow-hidden rounded-md border border-border/50 bg-muted/30">
          <pre className="max-h-64 overflow-auto p-3 text-[11px] leading-relaxed text-foreground/80">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
