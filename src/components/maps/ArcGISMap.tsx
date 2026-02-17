"use client";

/**
 * ArcGIS Map Component with OAuth 2.0 Authentication
 *
 * This replaces the unsupported "ArcGIS for Power BI" embedded visual.
 * It loads the same Web Map directly from ArcGIS Online using OAuth 2.0.
 *
 * How it works:
 * 1. User opens the page → OAuth popup redirects to ArcGIS login
 * 2. ArcGIS returns a token
 * 3. Token loads the Web Map + all its layers
 * 4. Token auto-refreshes (managed by ArcGIS IdentityManager)
 *
 * Required env vars:
 *   NEXT_PUBLIC_ARCGIS_CLIENT_ID  — from developers.arcgis.com OAuth 2.0 credentials
 *   NEXT_PUBLIC_ARCGIS_WEBMAP_ID  — the portal item ID of your Web Map
 */

import { useEffect, useRef, useState } from "react";

// Import ArcGIS CSS
import "@arcgis/core/assets/esri/themes/light/main.css";

// ArcGIS modules
import esriConfig from "@arcgis/core/config";
import OAuthInfo from "@arcgis/core/identity/OAuthInfo";
import IdentityManager from "@arcgis/core/identity/IdentityManager";
import WebMap from "@arcgis/core/WebMap";
import MapView from "@arcgis/core/views/MapView";
import Portal from "@arcgis/core/portal/Portal";

type ArcGISMapProps = {
    /** Override the Web Map ID (defaults to NEXT_PUBLIC_ARCGIS_WEBMAP_ID) */
    webMapId?: string;
    /** Override the OAuth Client ID (defaults to NEXT_PUBLIC_ARCGIS_CLIENT_ID) */
    clientId?: string;
    /** CSS class name for the container */
    className?: string;
    /** Height of the map container (default: 500px) */
    height?: string;
};

export function ArcGISMap({
    webMapId,
    clientId,
    className = "",
    height = "500px",
}: ArcGISMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MapView | null>(null);
    const [status, setStatus] = useState<
        "loading" | "authenticating" | "ready" | "error"
    >("loading");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    const resolvedClientId =
        clientId || process.env.NEXT_PUBLIC_ARCGIS_CLIENT_ID || "";
    const resolvedWebMapId =
        webMapId || process.env.NEXT_PUBLIC_ARCGIS_WEBMAP_ID || "";

    useEffect(() => {
        if (!mapRef.current) return;

        // Validate configuration
        if (!resolvedClientId || resolvedClientId === "YOUR_CLIENT_ID_HERE") {
            setStatus("error");
            setErrorMessage(
                "ArcGIS Client ID not configured. Set NEXT_PUBLIC_ARCGIS_CLIENT_ID in your .env file."
            );
            return;
        }

        if (!resolvedWebMapId || resolvedWebMapId === "YOUR_WEBMAP_ID_HERE") {
            setStatus("error");
            setErrorMessage(
                "ArcGIS Web Map ID not configured. Set NEXT_PUBLIC_ARCGIS_WEBMAP_ID in your .env file."
            );
            return;
        }

        // Set up ArcGIS configuration
        // Use the API key if available as a fallback
        const apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;
        if (apiKey) {
            esriConfig.apiKey = apiKey;
        }

        let cancelled = false;

        async function initMap() {
            try {
                setStatus("authenticating");

                // ========================================
                // Step 1: Register OAuth 2.0 credentials
                // ========================================
                const oAuthInfo = new OAuthInfo({
                    appId: resolvedClientId,
                    popup: true, // Opens a popup for ArcGIS login
                    popupCallbackUrl: `${window.location.origin}/oauth-callback.html`,
                    // portalUrl defaults to "https://www.arcgis.com"
                });

                IdentityManager.registerOAuthInfos([oAuthInfo]);

                // ========================================
                // Step 2: Check if user is already signed in
                //         or prompt for sign-in
                // ========================================
                let credential;
                try {
                    // Try to get existing credentials (already logged in)
                    credential = await IdentityManager.checkSignInStatus(
                        oAuthInfo.portalUrl + "/sharing"
                    );
                } catch {
                    // Not signed in yet — this will open the OAuth popup
                    credential = await IdentityManager.getCredential(
                        oAuthInfo.portalUrl + "/sharing"
                    );
                }

                if (cancelled) return;

                // ========================================
                // Step 3: Get user info from the portal
                // ========================================
                const portal = new Portal();
                portal.authMode = "immediate";
                await portal.load();

                if (portal.user) {
                    setUserName(portal.user.fullName || portal.user.username);
                }

                if (cancelled) return;

                // ========================================
                // Step 4: Load the Web Map
                // ========================================
                const webmap = new WebMap({
                    portalItem: {
                        id: resolvedWebMapId,
                    },
                });

                // ========================================
                // Step 5: Create the MapView
                // ========================================
                const view = new MapView({
                    container: mapRef.current!,
                    map: webmap,
                    padding: { top: 0, right: 0, bottom: 0, left: 0 },
                });

                viewRef.current = view;

                // Wait for the view to finish loading
                await view.when();

                if (cancelled) {
                    view.destroy();
                    return;
                }

                setStatus("ready");
                console.log("[ArcGIS] Map loaded successfully");
            } catch (err: any) {
                if (cancelled) return;

                console.error("[ArcGIS] Error initializing map:", err);
                setStatus("error");

                // Provide user-friendly error messages
                if (err?.message?.includes("User denied")) {
                    setErrorMessage(
                        "ArcGIS sign-in was cancelled. Please refresh and sign in to view the map."
                    );
                } else if (err?.message?.includes("Invalid client_id")) {
                    setErrorMessage(
                        "Invalid ArcGIS Client ID. Please check NEXT_PUBLIC_ARCGIS_CLIENT_ID in your .env file."
                    );
                } else if (err?.message?.includes("Item does not exist")) {
                    setErrorMessage(
                        "Web Map not found. Please check NEXT_PUBLIC_ARCGIS_WEBMAP_ID in your .env file."
                    );
                } else {
                    setErrorMessage(
                        err?.message || "Failed to load ArcGIS map. Check the console for details."
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
        };
    }, [resolvedClientId, resolvedWebMapId]);

    return (
        <div className={`arcgis-map-container ${className}`}>
            {/* Status Bar */}
            {status === "authenticating" && (
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

            {status === "ready" && userName && (
                <div className="flex items-center justify-between px-4 py-2 bg-green-50 border border-green-200 rounded-t-lg text-green-700 text-sm">
                    <span>
                        ✅ Connected to ArcGIS as <strong>{userName}</strong>
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
                    <p className="font-medium mb-1">⚠️ Map Error</p>
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
                    className={`rounded-b-lg overflow-hidden border border-gray-200 ${status === "loading" ? "bg-gray-100 animate-pulse" : ""
                        }`}
                />
            )}
        </div>
    );
}

export default ArcGISMap;
