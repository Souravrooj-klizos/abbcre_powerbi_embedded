"use client";

/**
 * Client-only Power BI embed view. Loaded with dynamic(ssr: false) to avoid
 * "self is not defined" — powerbi-client-react expects browser globals.
 */

import { PowerBIEmbed } from "powerbi-client-react";
import { models } from "powerbi-client";

export type ReportEmbedViewProps = {
  reportId: string;
  embedUrl: string;
  accessToken: string;
};

export function ReportEmbedView({ reportId, embedUrl, accessToken }: ReportEmbedViewProps) {
  const embedConfig: models.IReportEmbedConfiguration = {
    type: "report",
    id: reportId,
    embedUrl,
    accessToken,
    tokenType: models.TokenType.Embed,
    settings: {
      panes: {
        filters: { expanded: false, visible: false },
      },
      background: models.BackgroundType.Transparent,
    },
  };

  return (
    <div className="w-full rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm min-h-[500px]">
      <PowerBIEmbed
        embedConfig={embedConfig}
        cssClassName="w-full aspect-video min-h-[500px]"
      />
    </div>
  );
}
