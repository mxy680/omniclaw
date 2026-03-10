"use client";

import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import {
  ChevronRight,
  Play,
  Loader2,
  Check,
  X,
  Trash2,
  Mail,
  Calendar,
  HardDrive,
  FileText,
  Table,
  Presentation,
  Youtube,
  Github,
  Sparkles,
  Sigma,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  gmail: Mail,
  calendar: Calendar,
  drive: HardDrive,
  docs: FileText,
  sheets: Table,
  slides: Presentation,
  youtube: Youtube,
  github: Github,
  gemini: Sparkles,
  wolfram: Sigma,
};

const COLOR_MAP: Record<string, string> = {
  gmail: "#EA4335",
  calendar: "#4285F4",
  drive: "#0F9D58",
  docs: "#4285F4",
  sheets: "#0F9D58",
  slides: "#F4B400",
  youtube: "#FF0000",
  github: "#24292F",
  gemini: "#4285F4",
  wolfram: "#DD1100",
};

interface StepResult {
  name: string;
  tool: string;
  status: "success" | "error" | "skipped";
  duration: number;
  error?: string;
  cleanup?: boolean;
}

export interface ServiceTestPanelHandle {
  testAll: () => Promise<void>;
}

interface ServiceTestPanelProps {
  serviceId: string;
  serviceName: string;
  toolCount: number;
}

export const ServiceTestPanel = forwardRef<ServiceTestPanelHandle, ServiceTestPanelProps>(
  function ServiceTestPanel({ serviceId, serviceName, toolCount }, ref) {
    const [expanded, setExpanded] = useState(false);
    const [running, setRunning] = useState(false);
    const [steps, setSteps] = useState<StepResult[]>([]);
    const [totalDuration, setTotalDuration] = useState<number | null>(null);

    const Icon = ICON_MAP[serviceId];
    const color = COLOR_MAP[serviceId];

    const runTest = useCallback(async () => {
      setRunning(true);
      setSteps([]);
      setTotalDuration(null);
      setExpanded(true);

      try {
        const res = await fetch("/api/tools/test-service", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service: serviceId }),
        });
        const data = await res.json();

        if (data.error) {
          setSteps([{ name: "Test failed", tool: "", status: "error", duration: 0, error: data.error }]);
        } else {
          setSteps(data.steps ?? []);
          setTotalDuration(data.totalDuration ?? null);
        }
      } catch (err) {
        setSteps([{
          name: "Network error",
          tool: "",
          status: "error",
          duration: 0,
          error: err instanceof Error ? err.message : "Failed to connect",
        }]);
      } finally {
        setRunning(false);
      }
    }, [serviceId]);

    useImperativeHandle(ref, () => ({ testAll: runTest }), [runTest]);

    const passed = steps.filter((s) => s.status === "success").length;
    const failed = steps.filter((s) => s.status === "error").length;
    const skipped = steps.filter((s) => s.status === "skipped").length;
    const ran = passed + failed;

    return (
      <div className="overflow-hidden rounded-lg border border-border/50">
        {/* Header */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded(!expanded)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
          className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
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
            {toolCount} tool{toolCount !== 1 ? "s" : ""}
          </span>

          {/* Test result summary */}
          {steps.length > 0 && !running && (
            <span className="text-[11px] text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400">
                {passed}/{ran} passed
              </span>
              {failed > 0 && (
                <>
                  {" "}
                  <span className="text-red-600 dark:text-red-400">
                    ({failed} failed)
                  </span>
                </>
              )}
              {skipped > 0 && (
                <>
                  {" · "}
                  <span className="text-amber-600 dark:text-amber-400">
                    {skipped} skipped
                  </span>
                </>
              )}
              {totalDuration !== null && (
                <span className="ml-1 text-muted-foreground/70">
                  {totalDuration}ms
                </span>
              )}
            </span>
          )}

          <div className="flex-1" />

          {/* Test button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              if (!running) runTest();
            }}
            disabled={running}
          >
            {running ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Test
              </>
            )}
          </Button>
        </div>

        {/* Test steps */}
        {expanded && (
          <div className="border-t border-border/50 py-1">
            {running && steps.length === 0 && (
              <div className="flex items-center gap-3 px-3 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-[12px] text-muted-foreground">
                  Running smoke test...
                </span>
              </div>
            )}

            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {step.status === "success" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : step.status === "skipped" ? (
                    <SkipForward className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-red-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[12px] font-medium ${step.cleanup ? "text-muted-foreground" : "text-foreground/90"}`}>
                      {step.cleanup && <Trash2 className="mr-1 inline h-3 w-3" />}
                      {step.name}
                    </span>
                    {step.tool && (
                      <code className="text-[10px] text-muted-foreground/60">
                        {step.tool}
                      </code>
                    )}
                  </div>
                  {step.status === "error" && step.error && (
                    <p className="mt-0.5 truncate text-[11px] text-red-600 dark:text-red-400">
                      {step.error}
                    </p>
                  )}
                  {step.status === "skipped" && step.error && (
                    <p className="mt-0.5 truncate text-[11px] text-amber-600 dark:text-amber-400">
                      {step.error}
                    </p>
                  )}
                </div>

                <span className="shrink-0 text-[11px] text-muted-foreground/60">
                  {step.duration}ms
                </span>
              </div>
            ))}

            {!running && steps.length === 0 && (
              <div className="px-3 py-4 text-center">
                <p className="text-[12px] text-muted-foreground">
                  Click Test to run a round-trip smoke test
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
