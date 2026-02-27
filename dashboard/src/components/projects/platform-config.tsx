import type { WsProjectLink } from "@/lib/websocket";
import {
  Github,
  Triangle,
  Database,
  Cloud,
  Package,
  Box,
  Server,
  Globe,
  Star,
  GitFork,
  GitPullRequest,
} from "lucide-react";

// ── Platform config ─────────────────────────────────────────────────

export const PLATFORM_CONFIG: Record<
  string,
  { icon: typeof Github; color: string; label: string }
> = {
  github: { icon: Github, color: "#f0f6fc", label: "GitHub" },
  vercel: { icon: Triangle, color: "#ffffff", label: "Vercel" },
  supabase: { icon: Database, color: "#3ecf8e", label: "Supabase" },
  cloudflare: { icon: Cloud, color: "#f6821f", label: "Cloudflare" },
  npm: { icon: Package, color: "#cb3837", label: "npm" },
  pypi: { icon: Package, color: "#3775a9", label: "PyPI" },
  "docker-hub": { icon: Box, color: "#2496ed", label: "Docker Hub" },
  hetzner: { icon: Server, color: "#d50c2d", label: "Hetzner" },
};

export function getPlatformConfig(platform: string) {
  return (
    PLATFORM_CONFIG[platform] ?? {
      icon: Globe,
      color: "#888",
      label: platform,
    }
  );
}

// ── GitHub metadata display ─────────────────────────────────────────

export function GitHubMeta({ metadata }: { metadata: Record<string, unknown> }) {
  const language = typeof metadata.language === "string" ? metadata.language : null;
  const languageColor = typeof metadata.languageColor === "string" ? metadata.languageColor : "#888";
  const stars = typeof metadata.stars === "number" ? metadata.stars : 0;
  const forks = typeof metadata.forks === "number" ? metadata.forks : 0;
  const openPRs = typeof metadata.openPRs === "number" ? metadata.openPRs : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {language && (
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: languageColor }}
          />
          {language}
        </span>
      )}
      {stars > 0 && (
        <span className="flex items-center gap-1">
          <Star className="h-3 w-3" /> {stars}
        </span>
      )}
      {forks > 0 && (
        <span className="flex items-center gap-1">
          <GitFork className="h-3 w-3" /> {forks}
        </span>
      )}
      {openPRs !== null && (
        <span className="flex items-center gap-1">
          <GitPullRequest className="h-3 w-3" /> {openPRs} PRs
        </span>
      )}
    </div>
  );
}

// ── Link detail card ────────────────────────────────────────────────

export function LinkDetail({ link }: { link: WsProjectLink }) {
  const cfg = getPlatformConfig(link.platform);
  const Icon = cfg.icon;
  const meta = link.metadata as Record<string, unknown> | null;

  return (
    <div className="rounded-lg border border-border bg-background/50 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${cfg.color}20` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{cfg.label}</span>
            <span className="truncate text-xs text-muted-foreground">
              {link.displayName || link.identifier}
            </span>
          </div>
        </div>
      </div>
      {meta && link.platform === "github" && (
        <div className="mt-2 pl-8">
          <GitHubMeta metadata={meta} />
        </div>
      )}
    </div>
  );
}
