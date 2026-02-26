"use client";

import { SectionHeader } from "@/components/section-header";
import { MetricCard } from "@/components/metric-card";
import { IntegrationStatusCard } from "@/components/integration-status-card";
import { SectionActivityFeed } from "@/components/section-activity-feed";
import type { Section } from "@/lib/sections";
import { getActiveIntegrationIds } from "@/lib/sections";

interface SectionPageProps {
  section: Section;
}

export function SectionPage({ section }: SectionPageProps) {
  const activeIntegrations = section.integrations.filter(
    (i) => i.status === "active",
  );
  const plannedIntegrations = section.integrations.filter(
    (i) => i.status === "planned",
  );
  const activeIds = getActiveIntegrationIds(section.id);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <SectionHeader
        icon={section.icon}
        color={section.color}
        title={section.title}
        tagline={section.tagline}
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {section.metrics.map((m) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            source={m.source}
          />
        ))}
      </div>

      {/* Connected integrations */}
      {activeIntegrations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Connected Integrations
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activeIntegrations.map((i) => (
              <IntegrationStatusCard key={i.id} integration={i} />
            ))}
          </div>
        </div>
      )}

      {/* Planned integrations */}
      {plannedIntegrations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Planned Integrations
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plannedIntegrations.map((i) => (
              <IntegrationStatusCard key={i.id} integration={i} />
            ))}
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Recent Activity
        </h2>
        <SectionActivityFeed integrationIds={activeIds} />
      </div>
    </div>
  );
}
