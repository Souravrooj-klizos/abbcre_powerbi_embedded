"use client";

/**
 * ArcGIS Map Component with bi-directional filter sync to Power BI.
 *
 * Auth modes (unchanged):
 *   Preferred: API Key → no sign-in for viewers.
 *   Fallback:  OAuth 2.0 → each viewer signs in.
 *
 * Filter sync:
 *   Power BI → ArcGIS:
 *     Reads activeFilters from MapReportFilterContext (source="powerbi").
 *     Applies `definitionExpression` on matching FeatureLayers.
 *
 *   ArcGIS → Power BI:
 *     On map click (hit test), reads feature attributes, maps them via
 *     FIELD_MAPPINGS, and pushes FilterEntries to context (source="arcgis").
 *     Power BI ReportEmbedView picks them up and calls report.setFilters().
 */

import { useEffect, useRef, useState, useCallback } from "react";

import "@arcgis/core/assets/esri/themes/light/main.css";

import esriConfig from "@arcgis/core/config";
import OAuthInfo from "@arcgis/core/identity/OAuthInfo";
import IdentityManager from "@arcgis/core/identity/IdentityManager";
import WebMap from "@arcgis/core/WebMap";
import MapView from "@arcgis/core/views/MapView";
import Portal from "@arcgis/core/portal/Portal";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";

import {
    useMapReportFilters,
    type FilterEntry,
} from "@/context/MapReportFilterContext";
import { FIELD_MAPPINGS } from "@/config/filter-mapping";

type ArcGISMapProps = {
    webMapId?: string;
    clientId?: string;
    apiKey?: string;
    className?: string;
    height?: string;
};

export function ArcGISMap({
    webMapId,
    clientId,
    apiKey: apiKeyProp,
    className = "",
    height = "500px",
}: ArcGISMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MapView | null>(null);
    const webmapRef = useRef<WebMap | null>(null);
    const [status, setStatus] = useState<
        "loading" | "authenticating" | "ready" | "error"
    >("loading");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [authMode, setAuthMode] = useState<"apiKey" | "oauth">("apiKey");
    const [activeFilterLabel, setActiveFilterLabel] = useState<string | null>(
        null,
    );

    const { activeFilters, setFilters, clearFilters } = useMapReportFilters();

    const resolvedApiKey =
        apiKeyProp || process.env.NEXT_PUBLIC_ARCGIS_API_KEY || "";
    const resolvedClientId =
        clientId || process.env.NEXT_PUBLIC_ARCGIS_CLIENT_ID || "";
    const resolvedWebMapId =
        webMapId || process.env.NEXT_PUBLIC_ARCGIS_WEBMAP_ID || "";

    // ── Helper: build SQL where clause from filter entries ─────────────
    const buildWhereClause = useCallback(
        (layer: FeatureLayer, filters: FilterEntry[]): string | null => {
            const clauses: string[] = [];

            for (const filter of filters) {
                // Find mapping for this filter → layer pair
                const mapping = FIELD_MAPPINGS.find((m) => {
                    const fieldMatch = m.arcgisField === filter.field;
                    const layerMatch =
                        !m.arcgisLayerTitle ||
                        m.arcgisLayerTitle === layer.title;
                    return fieldMatch && layerMatch;
                });

                const fieldName = mapping?.arcgisField ?? filter.field;

                if (filter.values.length === 1) {
                    const v = filter.values[0];
                    clauses.push(
                        typeof v === "number"
                            ? `${fieldName} = ${v}`
                            : `${fieldName} = '${v.toString().replace(/'/g, "''")}'`,
                    );
                } else if (filter.values.length > 1) {
                    const vals = filter.values
                        .map((v) =>
                            typeof v === "number"
                                ? v
                                : `'${v.toString().replace(/'/g, "''")}'`,
                        )
                        .join(", ");
                    clauses.push(`${fieldName} IN (${vals})`);
                }
            }

            return clauses.length > 0 ? clauses.join(" AND ") : null;
        },
        [],
    );

    // ── Power BI → ArcGIS: apply incoming filters to map layers ───────
    useEffect(() => {
        const webmap = webmapRef.current;
        if (!webmap || status !== "ready") return;

        const pbiFilters = activeFilters.filter((f) => f.source === "powerbi");

        if (pbiFilters.length === 0) {
            // Clear all definitionExpressions
            for (const layer of webmap.layers) {
                if (layer.type === "feature") {
                    (layer as FeatureLayer).definitionExpression = "";
                }
            }
            setActiveFilterLabel(null);
            return;
        }

        // Apply filters to matching FeatureLayers
        for (const layer of webmap.layers) {
            if (layer.type === "feature") {
                const fl = layer as FeatureLayer;
                const where = buildWhereClause(fl, pbiFilters);
                fl.definitionExpression = where ?? "";
            }
        }

        // Build a human-readable label
        const label = pbiFilters
            .map((f) => `${f.field}: ${f.values.join(", ")}`)
            .join(" | ");
        setActiveFilterLabel(label);

        console.log(
            "[ArcGIS] Applied Power BI filters →",
            pbiFilters,
        );
    }, [activeFilters, status, buildWhereClause]);

    // ── ArcGIS → Power BI: map click handler ──────────────────────────
    const handleMapClick = useCallback(
        async (view: MapView) => {
            view.on("click", async (event) => {
                const response = await view.hitTest(event);
                const results = response.results.filter(
                    (r): r is __esri.GraphicHit => r.type === "graphic",
                );

                if (results.length === 0) {
                    clearFilters();
                    return;
                }

                const graphic = results[0].graphic;
                const attrs = graphic.attributes;
                if (!attrs) return;

                const layerTitle =
                    graphic.layer && "title" in graphic.layer
                        ? (graphic.layer as FeatureLayer).title
                        : undefined;

                const newFilters: FilterEntry[] = [];

                for (const mapping of FIELD_MAPPINGS) {
                    // Only use mappings that match this layer (or have no layerTitle filter)
                    if (
                        mapping.arcgisLayerTitle &&
                        mapping.arcgisLayerTitle !== layerTitle
                    ) {
                        continue;
                    }

                    const value = attrs[mapping.arcgisField];
                    if (value !== undefined && value !== null) {
                        newFilters.push({
                            field: mapping.arcgisField,
                            powerbiTable: mapping.powerbiTable,
                            powerbiColumn: mapping.powerbiColumn,
                            values: [value],
                            source: "arcgis",
                        });
                    }
                }

                if (newFilters.length > 0) {
                    setFilters(newFilters);
                    console.log(
                        "[ArcGIS] Map click → pushing filters to Power BI:",
                        newFilters,
                    );
                }
            });
        },
        [setFilters, clearFilters],
    );

    // ── Map initialisation (unchanged logic, with click handler added) ─
    useEffect(() => {
        if (!mapRef.current) return;

        if (!resolvedWebMapId || resolvedWebMapId === "YOUR_WEBMAP_ID_HERE") {
            setStatus("error");
            setErrorMessage(
                "ArcGIS Web Map ID not configured. Set NEXT_PUBLIC_ARCGIS_WEBMAP_ID in your .env file.",
            );
            return;
        }

        const useApiKey =
            !!resolvedApiKey && resolvedApiKey !== "YOUR_API_KEY_HERE";

        if (!useApiKey) {
            if (
                !resolvedClientId ||
                resolvedClientId === "YOUR_CLIENT_ID_HERE"
            ) {
                setStatus("error");
                setErrorMessage(
                    "Configure ArcGIS: set NEXT_PUBLIC_ARCGIS_API_KEY (recommended, no sign-in) or NEXT_PUBLIC_ARCGIS_CLIENT_ID (OAuth sign-in) in your .env file.",
                );
                return;
            }
        }

        if (useApiKey) {
            esriConfig.apiKey = resolvedApiKey;
            setAuthMode("apiKey");
        } else {
            setAuthMode("oauth");
        }

        let cancelled = false;

        async function loadMapWithApiKey(): Promise<void> {
            const webmap = new WebMap({
                portalItem: { id: resolvedWebMapId },
            });
            webmapRef.current = webmap;
            const view = new MapView({
                container: mapRef.current!,
                map: webmap,
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
            });
            viewRef.current = view;
            await view.when();
            if (cancelled) {
                view.destroy();
                return;
            }
            handleMapClick(view);
            setStatus("ready");
            console.log(
                "[ArcGIS] Map loaded with API key (no sign-in required)",
            );
        }

        async function loadMapWithOAuth(): Promise<void> {
            const oAuthInfo = new OAuthInfo({
                appId: resolvedClientId,
                popup: true,
                popupCallbackUrl: `${window.location.origin}/oauth-callback.html`,
            });
            IdentityManager.registerOAuthInfos([oAuthInfo]);

            let _credential;
            try {
                _credential = await IdentityManager.checkSignInStatus(
                    oAuthInfo.portalUrl + "/sharing",
                );
            } catch {
                _credential = await IdentityManager.getCredential(
                    oAuthInfo.portalUrl + "/sharing",
                );
            }

            if (cancelled) return;

            const portal = new Portal();
            portal.authMode = "immediate";
            await portal.load();
            if (portal.user) {
                setUserName(portal.user.fullName || portal.user.username);
            }
            if (cancelled) return;

            const webmap = new WebMap({
                portalItem: { id: resolvedWebMapId },
            });
            webmapRef.current = webmap;
            const view = new MapView({
                container: mapRef.current!,
                map: webmap,
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
            });
            viewRef.current = view;
            await view.when();
            if (cancelled) {
                view.destroy();
                return;
            }
            handleMapClick(view);
            setStatus("ready");
            console.log("[ArcGIS] Map loaded with OAuth");
        }

        async function initMap() {
            try {
                if (!useApiKey) setStatus("authenticating");

                if (useApiKey) {
                    await loadMapWithApiKey();
                } else {
                    await loadMapWithOAuth();
                }
            } catch (err: unknown) {
                if (cancelled) return;

                console.error("[ArcGIS] Error initializing map:", err);
                setStatus("error");

                const message =
                    err instanceof Error ? err.message : String(err);

                if (
                    message.includes("user-aborted") ||
                    message.includes("ABORTED")
                ) {
                    setErrorMessage(
                        "Sign-in was cancelled. Click Retry to sign in again, or ask your admin to use an ArcGIS API key so viewers don't need to sign in.",
                    );
                } else if (message.includes("User denied")) {
                    setErrorMessage(
                        "ArcGIS sign-in was cancelled. Please refresh and sign in to view the map.",
                    );
                } else if (message.includes("Invalid client_id")) {
                    setErrorMessage(
                        "Invalid ArcGIS Client ID. Please check NEXT_PUBLIC_ARCGIS_CLIENT_ID in your .env file.",
                    );
                } else if (message.includes("Item does not exist")) {
                    setErrorMessage(
                        "Web Map not found. Please check NEXT_PUBLIC_ARCGIS_WEBMAP_ID in your .env file.",
                    );
                } else if (
                    message.includes("Invalid API key") ||
                    message.includes("API key")
                ) {
                    setErrorMessage(
                        "Invalid ArcGIS API key. Check NEXT_PUBLIC_ARCGIS_API_KEY or use OAuth (NEXT_PUBLIC_ARCGIS_CLIENT_ID) instead.",
                    );
                } else {
                    setErrorMessage(
                        message ||
                            "Failed to load ArcGIS map. Check the console for details.",
                    );
                }
            }
        }

        initMap();

        return () => {
            cancelled = true;
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
            webmapRef.current = null;
        };
    }, [resolvedApiKey, resolvedClientId, resolvedWebMapId, handleMapClick]);

    return (
        <div className={`arcgis-map-container ${className}`}>
            {/* Active filter indicator */}
            {activeFilterLabel && status === "ready" && (
                <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-t-lg text-indigo-700 text-sm">
                    <span>
                        Filtered: <strong>{activeFilterLabel}</strong>
                    </span>
                    <button
                        onClick={() => clearFilters()}
                        className="text-indigo-600 hover:text-indigo-800 underline text-xs"
                    >
                        Clear filters
                    </button>
                </div>
            )}

            {/* Status Bar: only show "sign in" / "signed in" when using OAuth */}
            {status === "authenticating" && authMode === "oauth" && (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-t-lg text-blue-700 text-sm">
                    <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                    Connecting to ArcGIS… Please sign in if prompted.
                </div>
            )}

            {status === "ready" && authMode === "oauth" && userName && (
                <div className="flex items-center justify-between px-4 py-2 bg-green-50 border border-green-200 rounded-t-lg text-green-700 text-sm">
                    <span>
                        Connected to ArcGIS as <strong>{userName}</strong>
                    </span>
                    <button
                        onClick={() => {
                            IdentityManager.destroyCredentials();
                            window.location.reload();
                        }}
                        className="text-green-600 hover:text-green-800 underline text-xs"
                    >
                        Sign out
                    </button>
                </div>
            )}

            {/* Error State */}
            {status === "error" && (
                <div className="px-4 py-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
                    <p className="font-medium mb-1">Map Error</p>
                    <p className="text-sm">{errorMessage}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-3 px-4 py-1.5 bg-red-100 hover:bg-red-200 rounded text-red-800 text-sm transition"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Map Container */}
            {status !== "error" && (
                <div
                    ref={mapRef}
                    style={{ width: "100%", height }}
                    className={`rounded-b-lg overflow-hidden border border-gray-200 ${
                        status === "loading"
                            ? "bg-gray-100 animate-pulse"
                            : ""
                    }`}
                />
            )}
        </div>
    );
}

export default ArcGISMap;
