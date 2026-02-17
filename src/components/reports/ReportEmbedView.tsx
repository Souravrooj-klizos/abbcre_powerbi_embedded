"use client";

/**
 * Client-only Power BI embed view with bi-directional filter sync.
 *
 * Power BI → ArcGIS:
 *   Listens to `dataSelected` events. Extracts selected data-point values,
 *   maps them via FIELD_MAPPINGS, and pushes FilterEntries to the shared context.
 *
 * ArcGIS → Power BI:
 *   Watches context.activeFilters for entries with source="arcgis".
 *   Converts them to Power BI BasicFilters and calls report.setFilters().
 */

import { useCallback, useEffect, useRef } from "react";
import { PowerBIEmbed } from "powerbi-client-react";
import { models, Report, service } from "powerbi-client";
import type { EventHandler } from "powerbi-client-react";
import {
  useMapReportFilters,
  type FilterEntry,
} from "@/context/MapReportFilterContext";
import { FIELD_MAPPINGS } from "@/config/filter-mapping";

export type ReportEmbedViewProps = {
  reportId: string;
  embedUrl: string;
  accessToken: string;
};

export function ReportEmbedView({
  reportId,
  embedUrl,
  accessToken,
}: ReportEmbedViewProps) {
  const reportRef = useRef<Report | null>(null);
  const { activeFilters, setFilters } = useMapReportFilters();

  // ── Power BI → ArcGIS: capture data selections ──────────────────────
  const handleDataSelected = useCallback(
    (event?: service.ICustomEvent<unknown>) => {
      if (!event?.detail) return;

      const detail = event.detail as {
        dataPoints?: Array<{
          identity?: Array<{
            target?: { table?: string; column?: string };
            equals?: string | number;
          }>;
        }>;
      };

      const dataPoints = detail.dataPoints;
      if (!dataPoints || dataPoints.length === 0) {
        setFilters([]);
        return;
      }

      const newFilters: FilterEntry[] = [];

      for (const dp of dataPoints) {
        for (const id of dp.identity ?? []) {
          const table = id.target?.table;
          const column = id.target?.column;
          const value = id.equals;
          if (!table || !column || value === undefined) continue;

          const mapping = FIELD_MAPPINGS.find(
            (m) => m.powerbiTable === table && m.powerbiColumn === column,
          );

          if (mapping) {
            const existing = newFilters.find(
              (f) => f.field === mapping.arcgisField,
            );
            if (existing) {
              if (!existing.values.includes(value)) {
                existing.values.push(value);
              }
            } else {
              newFilters.push({
                field: mapping.arcgisField,
                powerbiTable: table,
                powerbiColumn: column,
                values: [value],
                source: "powerbi",
              });
            }
          } else {
            // No explicit mapping — pass through using column name as field
            const existing = newFilters.find((f) => f.field === column);
            if (existing) {
              if (!existing.values.includes(value)) {
                existing.values.push(value);
              }
            } else {
              newFilters.push({
                field: column,
                powerbiTable: table,
                powerbiColumn: column,
                values: [value],
                source: "powerbi",
              });
            }
          }
        }
      }

      setFilters(newFilters);
    },
    [setFilters],
  );

  // ── ArcGIS → Power BI: apply incoming filters to the report ─────────
  useEffect(() => {
    const report = reportRef.current;
    if (!report) return;

    const arcgisFilters = activeFilters.filter((f) => f.source === "arcgis");

    if (arcgisFilters.length === 0) {
      report.removeFilters().catch(() => {});
      return;
    }

    const pbiFilters: models.IBasicFilter[] = arcgisFilters
      .filter((f) => f.powerbiTable && f.powerbiColumn)
      .map((f) => ({
        $schema: "http://powerbi.com/product/schema#basic",
        filterType: models.FilterType.Basic,
        target: {
          table: f.powerbiTable!,
          column: f.powerbiColumn!,
        },
        operator: "In",
        values: f.values,
      }));

    if (pbiFilters.length > 0) {
      report.setFilters(pbiFilters).catch((err) => {
        console.error("[PowerBI] Failed to apply filters from ArcGIS:", err);
      });
    }
  }, [activeFilters]);

  // ── Embed configuration ─────────────────────────────────────────────
  const embedConfig: models.IReportEmbedConfiguration = {
    type: "report",
    id: reportId,
    embedUrl,
    accessToken,
    tokenType: models.TokenType.Embed,
    settings: {
      panes: {
        filters: { expanded: false, visible: true },
      },
      background: models.BackgroundType.Transparent,
    },
  };

  const eventHandlers = new Map<string, EventHandler>([
    ["dataSelected", handleDataSelected],
    [
      "loaded",
      () => {
        console.log("[PowerBI] Report loaded — filter sync enabled");
      },
    ],
  ]);

  return (
    <div className="w-full rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm min-h-[500px]">
      <PowerBIEmbed
        embedConfig={embedConfig}
        eventHandlers={eventHandlers}
        getEmbeddedComponent={(embedded) => {
          reportRef.current = embedded as Report;
        }}
        cssClassName="w-full aspect-video min-h-[500px]"
      />
    </div>
  );
}
