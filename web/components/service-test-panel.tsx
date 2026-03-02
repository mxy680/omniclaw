"use client";

import { useCallback, useRef, useState } from "react";
import {
  ChevronRight,
  Play,
  Loader2,
  Mail,
  Calendar,
  HardDrive,
  FileText,
  Table,
  Presentation,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolRow } from "@/components/tool-row";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  gmail: Mail,
  calendar: Calendar,
  drive: HardDrive,
  docs: FileText,
  sheets: Table,
  slides: Presentation,
  youtube: Youtube,
};

const COLOR_MAP: Record<string, string> = {
  gmail: "#EA4335",
  calendar: "#4285F4",
  drive: "#0F9D58",
  docs: "#4285F4",
  sheets: "#0F9D58",
  slides: "#F4B400",
  youtube: "#FF0000",
};

interface ToolInfo {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
}

interface ToolState {
  status: "idle" | "running" | "success" | "error";
  duration?: number;
  error?: string;
  result?: unknown;
}

interface ServiceTestPanelProps {
  serviceId: string;
  serviceName: string;
  tools: ToolInfo[];
  onTestingChange?: (testing: boolean) => void;
}

export function ServiceTestPanel({
  serviceId,
  serviceName,
  tools,
  onTestingChange,
}: ServiceTestPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [toolStates, setToolStates] = useState<Record<string, ToolState>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const abortRef = useRef(false);

  const Icon = ICON_MAP[serviceId];
  const color = COLOR_MAP[serviceId];

  const executeTool = useCallback(async (toolName: string) => {
    setToolStates((prev) => ({
      ...prev,
      [toolName]: { status: "running" },
    }));

    try {
      const res = await fetch("/api/tools/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolName, params: {} }),
      });
      const data = await res.json();

      if (data.success) {
        setToolStates((prev) => ({
          ...prev,
          [toolName]: {
            status: "success",
            duration: data.duration,
            result: data.result,
          },
        }));
      } else {
        setToolStates((prev) => ({
          ...prev,
          [toolName]: {
            status: "error",
            duration: data.duration,
            error: data.error,
          },
        }));
      }
    } catch (err) {
      setToolStates((prev) => ({
        ...prev,
        [toolName]: {
          status: "error",
          error: err instanceof Error ? err.message : "Network error",
        },
      }));
    }
  }, []);

  const testAll = useCallback(async () => {
    setBatchRunning(true);
    abortRef.current = false;
    onTestingChange?.(true);
    setExpanded(true);

    for (const tool of tools) {
      if (abortRef.current) break;
      await executeTool(tool.name);
    }

    setBatchRunning(false);
    onTestingChange?.(false);
  }, [tools, executeTool, onTestingChange]);

  // Aggregate status
  const states = Object.values(toolStates);
  const passed = states.filter((s) => s.status === "success").length;
  const failed = states.filter((s) => s.status === "error").length;
  const running = states.filter((s) => s.status === "running").length;
  const tested = passed + failed;

  return (
    <div className="overflow-hidden rounded-lg border border-border/50">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />

        {Icon && (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `${color}12` }}
          >
            <div style={{ color }}>
              <Icon className="h-3.5 w-3.5" />
            </div>
          </div>
        )}

        <span className="text-[13px] font-medium">{serviceName}</span>

        <span className="text-[11px] text-muted-foreground">
          {tools.length} tool{tools.length !== 1 ? "s" : ""}
        </span>

        {/* Aggregate status */}
        {tested > 0 && (
          <span className="text-[11px] text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400">
              {passed} passed
            </span>
            {failed > 0 && (
              <>
                {", "}
                <span className="text-red-600 dark:text-red-400">
                  {failed} failed
                </span>
              </>
            )}
            {running > 0 && (
              <>
                {", "}
                <span>{running} running</span>
              </>
            )}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Test All button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            if (batchRunning) {
              abortRef.current = true;
            } else {
              testAll();
            }
          }}
          disabled={false}
        >
          {batchRunning ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              Test All
            </>
          )}
        </Button>
      </button>

      {/* Tool list */}
      {expanded && (
        <div className="border-t border-border/50 py-1">
          {tools.map((tool) => {
            const state = toolStates[tool.name] ?? { status: "idle" as const };
            return (
              <ToolRow
                key={tool.name}
                tool={tool}
                status={state.status}
                duration={state.duration}
                error={state.error}
                result={state.result}
                onTest={() => executeTool(tool.name)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
