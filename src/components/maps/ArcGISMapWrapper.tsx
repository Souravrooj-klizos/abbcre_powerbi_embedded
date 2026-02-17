"use client";

/**
 * Dynamic wrapper for the ArcGIS Map component.
 * Loaded with ssr: false to avoid "window is not defined" errors
 * (ArcGIS SDK requires browser globals).
 */

import dynamic from "next/dynamic";

const ArcGISMapInner = dynamic(
    () => import("./ArcGISMap").then((m) => m.ArcGISMap),
    {
        ssr: false,
        loading: () => (
            <div className="w-full min-h-[500px] bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 animate-pulse">
                <p className="text-gray-500">Loading ArcGIS Map…</p>
            </div>
        ),
    }
);

type ArcGISMapWrapperProps = {
    webMapId?: string;
    clientId?: string;
    className?: string;
    height?: string;
};

export function ArcGISMapWrapper(props: ArcGISMapWrapperProps) {
    return <ArcGISMapInner {...props} />;
}

export default ArcGISMapWrapper;
