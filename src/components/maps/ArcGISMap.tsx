"use client";

/**
 * ArcGIS Map Component with bi-directional filter sync to Power BI.
 *
 * Auth: API Key (preferred, no sign-in) or OAuth 2.0 (fallback).
 *
 * Filter sync (Power BI → ArcGIS):
 *   Uses client-side FeatureFilter (via FeatureLayerView.filter) instead of
 *   server-side definitionExpression. This avoids "Failed to load tile" errors
 *   because we filter already-loaded features in the browser.
 *
 * Filter sync (ArcGIS → Power BI):
 *   On map click, reads feature attributes and pushes to shared context.
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
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter";
import Color from "@arcgis/core/Color";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import type Layer from "@arcgis/core/layers/Layer";
import type GroupLayer from "@arcgis/core/layers/GroupLayer";

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

/**
 * Recursively collect all FeatureLayers from a WebMap,
 * including those nested inside GroupLayers.
 */
function collectFeatureLayers(layers: __esri.Collection<Layer>): FeatureLayer[] {
    const result: FeatureLayer[] = [];
    for (const layer of layers) {
        if (layer.type === "feature") {
            result.push(layer as FeatureLayer);
        } else if (layer.type === "group") {
            const group = layer as unknown as GroupLayer;
            if (group.layers) {
                result.push(...collectFeatureLayers(group.layers));
            }
        }
    }
    return result;
}

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
    const initialExtentRef = useRef<__esri.Extent | null>(null);
    const highlightHandlesRef = useRef<__esri.Handle[]>([]);
    const hoverHighlightRef = useRef<__esri.Handle | null>(null);
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

    // ── Helper: build SQL where clause for a specific layer ──────────
    // Only includes filter entries that have a matching FIELD_MAPPING
    // for this layer. Applies transformValue if present.
    const buildWhereClause = useCallback(
        (layer: FeatureLayer, filters: FilterEntry[]): string | null => {
            const clauses: string[] = [];

            for (const filter of filters) {
                // Find all mappings that match this filter's Power BI column AND this layer
                const mapping = FIELD_MAPPINGS.find((m) => {
                    const columnMatch =
                        m.powerbiTable === filter.powerbiTable &&
                        m.powerbiColumn === filter.powerbiColumn;
                    const layerMatch =
                        !m.arcgisLayerTitle ||
                        m.arcgisLayerTitle === layer.title;
                    return columnMatch && layerMatch;
                });

                // No mapping for this layer → skip (don't apply unknown fields)
                if (!mapping) continue;

                const fieldName = mapping.arcgisField;
                const transform = mapping.transformValue;

                // Transform values (e.g. strip emoji prefix)
                const cleanValues = filter.values.map((v) =>
                    transform ? transform(v) : v,
                );

                if (cleanValues.length === 1) {
                    const v = cleanValues[0];
                    clauses.push(
                        typeof v === "number"
                            ? `${fieldName} = ${v}`
                            : `${fieldName} = '${v.toString().replace(/'/g, "''")}'`,
                    );
                } else if (cleanValues.length > 1) {
                    const vals = cleanValues
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

    // ── Power BI → ArcGIS: apply filters, zoom, and highlight ──────────
    useEffect(() => {
        const view = viewRef.current;
        const webmap = webmapRef.current;
        if (!view || !webmap || status !== "ready") return;

        const pbiFilters = activeFilters.filter((f) => f.source === "powerbi");

        const featureLayers = collectFeatureLayers(webmap.layers);

        // Clear previous highlights
        if (highlightHandlesRef.current.length > 0) {
            for (const h of highlightHandlesRef.current) h.remove();
            highlightHandlesRef.current = [];
        }

        if (pbiFilters.length === 0) {
            // Clear all client-side filters and reset view
            for (const fl of featureLayers) {
                view.whenLayerView(fl)
                    .then((layerView) => {
                        const flv = layerView as __esri.FeatureLayerView;
                        flv.filter = null as unknown as FeatureFilter;
                    })
                    .catch(() => {});
            }
            setActiveFilterLabel(null);
            // Zoom back to full extent
            if (initialExtentRef.current) {
                view.goTo(initialExtentRef.current, { duration: 600 }).catch(() => {});
            }
            return;
        }

        // Apply client-side filters + query for zoom + highlight
        let didZoom = false;

        for (const fl of featureLayers) {
            const where = buildWhereClause(fl, pbiFilters);

            view.whenLayerView(fl)
                .then(async (layerView) => {
                    const flv = layerView as __esri.FeatureLayerView;
                    if (where) {
                        flv.filter = new FeatureFilter({ where });
                        console.log(
                            `[ArcGIS] Client-side filter on "${fl.title}": ${where}`,
                        );

                        // Zoom to filtered features (use the first polygon/boundary layer for best extent)
                        if (!didZoom) {
                            try {
                                const query = fl.createQuery();
                                query.where = where;
                                query.returnGeometry = true;
                                query.outFields = ["*"];
                                const result = await fl.queryFeatures(query);

                                if (result.features.length > 0) {
                                    // Zoom to the extent of matching features
                                    let combinedExtent: __esri.Extent | null = null;
                                    for (const feat of result.features) {
                                        const geom = feat.geometry;
                                        if (!geom) continue;
                                        const ext = "extent" in geom && geom.extent
                                            ? geom.extent
                                            : null;
                                        if (ext) {
                                            combinedExtent = combinedExtent
                                                ? combinedExtent.union(ext)
                                                : ext;
                                        }
                                    }

                                    if (combinedExtent) {
                                        await view.goTo(
                                            combinedExtent.expand(1.3),
                                            { duration: 800 },
                                        );
                                        didZoom = true;
                                    }

                                    // Highlight matching features
                                    const handle = flv.highlight(
                                        result.features,
                                    );
                                    highlightHandlesRef.current.push(handle);
                                }
                            } catch (err) {
                                console.debug(
                                    `[ArcGIS] Zoom/highlight failed for "${fl.title}":`,
                                    err,
                                );
                            }
                        }
                    } else {
                        flv.filter = null as unknown as FeatureFilter;
                    }
                })
                .catch((err) => {
                    console.warn(
                        `[ArcGIS] Could not filter layer "${fl.title}":`,
                        err,
                    );
                });
        }

        // Build a clean label
        const label = pbiFilters
            .map((f) => {
                const mapping = FIELD_MAPPINGS.find(
                    (m) =>
                        m.powerbiTable === f.powerbiTable &&
                        m.powerbiColumn === f.powerbiColumn,
                );
                const transform = mapping?.transformValue;
                const cleanVals = f.values
                    .map((v) => (transform ? transform(v) : v))
                    .join(", ");
                const displayField = mapping?.arcgisField ?? f.field;
                return `${displayField}: ${cleanVals}`;
            })
            .join(" | ");
        setActiveFilterLabel(label);

        console.log("[ArcGIS] Applied Power BI filters (client-side) →", pbiFilters);
    }, [activeFilters, status, buildWhereClause]);

    // ── Setup popups, hover tooltips + highlight, click → filter sync ──
    const setupInteractions = useCallback(
        (view: MapView) => {
            // 1. Enable popups (WebMap already defines popupInfo per layer)
            view.popupEnabled = true;

            // Configure popup docking once popup is available
            if (view.popup) {
                view.popup.dockEnabled = true;
                view.popup.dockOptions = {
                    buttonEnabled: true,
                    breakpoint: false,
                    position: "top-right",
                };
            }

            // Track whether the popup was opened by a click (so hover doesn't close it)
            let popupOpenedByClick = false;

            // 2. Hover: show tooltip popup + highlight hovered feature
            let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

            view.on("pointer-move", (event) => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(async () => {
                    const response = await view.hitTest(event);
                    const results = response.results.filter(
                        (r): r is __esri.GraphicHit => r.type === "graphic",
                    );

                    // Remove previous hover highlight
                    if (hoverHighlightRef.current) {
                        hoverHighlightRef.current.remove();
                        hoverHighlightRef.current = null;
                    }

                    if (results.length > 0) {
                        const graphic = results[0].graphic;
                        const layer = graphic.layer;

                        // Change cursor to pointer
                        if (view.container) {
                            view.container.style.cursor = "pointer";
                        }

                        // Highlight the hovered feature
                        if (layer && layer.type === "feature") {
                            try {
                                const layerView = await view.whenLayerView(layer);
                                const flv = layerView as __esri.FeatureLayerView;
                                hoverHighlightRef.current = flv.highlight(graphic);
                            } catch {
                                // Layer may not support highlight
                            }
                        }

                        // Show hover popup only if no click-popup is active
                        if (!popupOpenedByClick && view.popup) {
                            view.popup.open({
                                features: [graphic],
                                location: view.toMap(event),
                            });
                        }
                    } else {
                        // Reset cursor
                        if (view.container) {
                            view.container.style.cursor = "default";
                        }

                        // Close hover popup only if it wasn't opened by a click
                        if (!popupOpenedByClick && view.popup?.visible) {
                            view.popup.close();
                        }
                    }
                }, 100);
            });

            // Reset popupOpenedByClick when popup is closed by user
            // Use reactiveUtils.watch (modern API) instead of popup.watch
            reactiveUtils.watch(
                () => view.popup?.visible,
                (visible) => {
                    if (!visible) {
                        popupOpenedByClick = false;
                    }
                },
            );

            // 3. Click: show popup (sticky) + push filters to Power BI
            view.on("click", async (event) => {
                const response = await view.hitTest(event);
                const results = response.results.filter(
                    (r): r is __esri.GraphicHit => r.type === "graphic",
                );

                if (results.length === 0) {
                    popupOpenedByClick = false;
                    view.popup?.close();
                    clearFilters();
                    return;
                }

                // Open popup with all hit features (user can browse with arrows)
                popupOpenedByClick = true;
                if (view.popup) {
                    view.popup.open({
                        features: results.map((r) => r.graphic),
                        location: view.toMap(event),
                    });
                }

                // Build filter entries from the first hit graphic
                const graphic = results[0].graphic;
                const attrs = graphic.attributes;
                if (!attrs) return;

                const layerTitle =
                    graphic.layer && "title" in graphic.layer
                        ? (graphic.layer as FeatureLayer).title
                        : undefined;

                const newFilters: FilterEntry[] = [];

                for (const mapping of FIELD_MAPPINGS) {
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

    // ── Map initialisation ────────────────────────────────────────────
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
                highlightOptions: {
                    color: new Color([0, 255, 255, 1]),
                    haloColor: new Color([0, 255, 255, 1]),
                    haloOpacity: 0.9,
                    fillOpacity: 0.25,
                },
            });
            viewRef.current = view;
            await view.when();
            if (cancelled) {
                view.destroy();
                return;
            }

            // Log all layers found for debugging field names
            const allLayers = collectFeatureLayers(webmap.layers);
            for (const fl of allLayers) {
                await fl.load();
                const fieldNames = fl.fields.map((f) => f.name);
                console.log(
                    `[ArcGIS] Layer "${fl.title}" fields:`,
                    fieldNames,
                );
            }

            initialExtentRef.current = view.extent.clone();
            setupInteractions(view);
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
                highlightOptions: {
                    color: new Color([0, 255, 255, 1]),
                    haloColor: new Color([0, 255, 255, 1]),
                    haloOpacity: 0.9,
                    fillOpacity: 0.25,
                },
            });
            viewRef.current = view;
            await view.when();
            if (cancelled) {
                view.destroy();
                return;
            }

            const allLayers = collectFeatureLayers(webmap.layers);
            for (const fl of allLayers) {
                await fl.load();
                const fieldNames = fl.fields.map((f) => f.name);
                console.log(
                    `[ArcGIS] Layer "${fl.title}" fields:`,
                    fieldNames,
                );
            }

            initialExtentRef.current = view.extent.clone();
            setupInteractions(view);
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
            for (const h of highlightHandlesRef.current) h.remove();
            highlightHandlesRef.current = [];
            if (hoverHighlightRef.current) {
                hoverHighlightRef.current.remove();
                hoverHighlightRef.current = null;
            }
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
            webmapRef.current = null;
            initialExtentRef.current = null;
        };
    }, [resolvedApiKey, resolvedClientId, resolvedWebMapId, setupInteractions]);

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
