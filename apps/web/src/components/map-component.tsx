"use client";

import { useEffect, useRef, useState, memo, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createRoot } from "react-dom/client";
import UserAvatar from "./user-avatar";
import ngeohash from "ngeohash";
import { Store } from "lucide-react";

// This would normally come from an environment variable
// For demo purposes, we're using a public token
const MAPBOX_TOKEN =
  "pk.eyJ1Ijoic291bmRicnVoIiwiYSI6ImNtYWlmeW8zODA2NW8yanM3NTVrbnZicHUifQ.zAlsz8FbfH8N4sUadaCylA";

// Storage key for geohash
const GEOHASH_STORAGE_KEY = "chat_geohash";

interface User {
  id: number;
  name: string;
  avatar: string;
  coordinates: [number, number];
  distance?: string;
  isUser?: boolean;
}

// Define business interface
interface Business {
  id: string;
  name: string;
  description: string;
  logo: string;
  coordinates: [number, number];
  ownerId: string;
}

interface MapComponentProps {
  users: User[];
  businesses?: Business[];
  centerCoordinates: [number, number] | null;
  geolocationError: string | null;
  onBusinessClick?: (business: Business) => void;
}

const MapComponent = memo(
  function MapComponent({
    users,
    businesses = [],
    centerCoordinates,
    geolocationError,
    onBusinessClick,
  }: MapComponentProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<{ [key: number]: mapboxgl.Marker }>({});
    const businessMarkersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
    const [mapLoaded, setMapLoaded] = useState(false);
    const [initialAnimationComplete, setInitialAnimationComplete] =
      useState(false);
    const geohashLayerRef = useRef<{
      sourceId: string | null;
      fillId: string | null;
      lineId: string | null;
    }>({
      sourceId: null,
      fillId: null,
      lineId: null,
    });

    // Add a ref to track the previous centerCoordinates to minimize redraws
    const prevCenterCoordinates = useRef<[number, number] | null>(null);

    // Add a ref to track the previous users to minimize redraws
    const prevUsers = useRef<User[]>([]);

    // Add a ref to track the previous businesses to minimize redraws
    const prevBusinesses = useRef<Business[]>([]);

    // Add a ref to track the previous geohash to minimize redraws
    const prevGeohash = useRef<string | null>(null);

    const updateGeohashDisplay = useCallback(
      (map: mapboxgl.Map, geohash: string) => {
        if (!geohash) return;

        try {
          // Remove existing geohash layers if they exist
          if (
            geohashLayerRef.current.fillId &&
            map.getLayer(geohashLayerRef.current.fillId)
          ) {
            map.removeLayer(geohashLayerRef.current.fillId);
          }

          if (
            geohashLayerRef.current.lineId &&
            map.getLayer(geohashLayerRef.current.lineId)
          ) {
            map.removeLayer(geohashLayerRef.current.lineId);
          }

          if (
            geohashLayerRef.current.sourceId &&
            map.getSource(geohashLayerRef.current.sourceId)
          ) {
            map.removeSource(geohashLayerRef.current.sourceId);
          }

          // Get bounding box for the geohash
          const bbox = ngeohash.decode_bbox(geohash);

          // Convert to GeoJSON format [[lon, lat], [lon, lat], ...]
          const coordinates = [
            [bbox[1], bbox[0]], // southwest
            [bbox[3], bbox[0]], // southeast
            [bbox[3], bbox[2]], // northeast
            [bbox[1], bbox[2]], // northwest
            [bbox[1], bbox[0]], // back to southwest to close the polygon
          ];

          // Create geojson data
          const geojsonData = {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [coordinates],
            },
          };

          // Create a unique ID for this geohash source
          const sourceId = `geohash-source-${Date.now()}`;
          const fillId = `${sourceId}-fill`;
          const lineId = `${sourceId}-line`;

          geohashLayerRef.current = {
            sourceId,
            fillId,
            lineId,
          };

          // Add new source
          map.addSource(sourceId, {
            type: "geojson",
            data: geojsonData as any,
          });

          // Add fill layer
          map.addLayer({
            id: fillId,
            type: "fill",
            source: sourceId,
            paint: {
              "fill-color": "#8a2be2",
              "fill-opacity": 0.2,
              "fill-outline-color": "#a64dff",
            },
          });

          // Add outline layer
          map.addLayer({
            id: lineId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": "#a64dff",
              "line-width": 2,
            },
          });

          // Add click handler
          const handleClick = (
            e: mapboxgl.MapMouseEvent & {
              features?: mapboxgl.MapboxGeoJSONFeature[];
            }
          ) => {
            if (!map || !e.features || !e.features[0]) return;

            // Calculate center of geohash area
            const center = [
              (bbox[1] + bbox[3]) / 2, // longitude
              (bbox[0] + bbox[2]) / 2, // latitude
            ];

            // Calculate area approximately
            const width =
              (bbox[3] - bbox[1]) *
              111.32 *
              Math.cos((bbox[0] * Math.PI) / 180);
            const height = (bbox[2] - bbox[0]) * 110.574;
            const area = (width * height).toFixed(2);

            // Removed popup creation for chat area
          };

          // Add event listener for the new layer
          map.on("click", fillId, handleClick);

          // Center map on geohash area if needed
          const centerOnGeohash = (geohash: string) => {
            if (!map) return;

            try {
              // Get bounding box of geohash
              const bbox = ngeohash.decode_bbox(geohash);

              // Convert to mapbox bounds format (southwest, northeast)
              const bounds = new mapboxgl.LngLatBounds(
                [bbox[1], bbox[0]], // Southwest corner
                [bbox[3], bbox[2]] // Northeast corner
              );

              // Fit map to these bounds with some padding
              map.fitBounds(bounds, {
                padding: 50,
                maxZoom: 16,
                duration: 1000,
              });
            } catch (error) {
              console.error("Error centering on geohash:", error);
            }
          };

          // Center on the geohash if a new geohash is selected
          if (geohash !== prevGeohash.current) {
            centerOnGeohash(geohash);
            prevGeohash.current = geohash;
          }

          // Add hover effects
          map.on("mouseenter", fillId, () => {
            if (map.getCanvas()) {
              map.getCanvas().style.cursor = "pointer";
              map.setPaintProperty(fillId, "fill-opacity", 0.4);
            }
          });

          map.on("mouseleave", fillId, () => {
            if (map.getCanvas()) {
              map.getCanvas().style.cursor = "";
              map.setPaintProperty(fillId, "fill-opacity", 0.2);
            }
          });
        } catch (error) {
          console.error("Error updating geohash display:", error);
        }
      },
      []
    );

    // Add custom styles for the popup - moved outside the useEffect to avoid recreation
    const businessPopupStyles = `
      .business-popup .mapboxgl-popup-content {
        background-color: #121212;
        color: #e2e2e2;
        border: 1px solid #3b3b3b;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
      }
      .business-popup .mapboxgl-popup-tip {
        border-top-color: #121212;
        border-bottom-color: #121212;
      }
      .business-tooltip .mapboxgl-popup-content {
        background-color: #121212;
        color: #e2e2e2;
        padding: 6px;
        border-radius: 4px;
      }
    `;

    // Add styles to document head once
    useEffect(() => {
      const styleElement = document.createElement("style");
      styleElement.textContent = businessPopupStyles;
      document.head.appendChild(styleElement);

      return () => {
        document.head.removeChild(styleElement);
      };
    }, []);

    useEffect(() => {
      if (!mapContainer.current) return;

      console.log("Initializing map");
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe", // Display the map as a globe
        center: [-74.006, 40.7128], // Initial center, will be overridden
        zoom: 1, // Initial zoom to see the globe
        attributionControl: false,
        logoPosition: "bottom-left",
      });

      map.current.on("style.load", () => {
        console.log("Map style loaded");
        if (map.current) {
          map.current.setFog({}); // Add atmosphere for globe view
        }
      });

      map.current.on("load", () => {
        console.log("Map fully loaded");
        setMapLoaded(true);
      });

      map.current.on("error", (e) => {
        console.error("Map error:", e);
      });

      return () => {
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
      };
    }, []); // Runs once on mount

    // Display geohash area based on localStorage value
    useEffect(() => {
      if (!map.current || !mapLoaded || !initialAnimationComplete) return;

      try {
        // Get geohash from localStorage
        const geohash = localStorage.getItem(GEOHASH_STORAGE_KEY);
        if (!geohash) return;

        updateGeohashDisplay(map.current, geohash);

        // Set up storage event listener
        const handleStorageChange = (event: StorageEvent) => {
          if (
            event.key === GEOHASH_STORAGE_KEY &&
            event.newValue &&
            map.current
          ) {
            updateGeohashDisplay(map.current, event.newValue);
          }
        };

        // Add event listener for storage changes
        window.addEventListener("storage", handleStorageChange);

        // Clean up
        return () => {
          window.removeEventListener("storage", handleStorageChange);
        };
      } catch (error) {
        console.error("Error displaying geohash area:", error);
      }
    }, [mapLoaded, initialAnimationComplete, updateGeohashDisplay]);

    // New useEffect to center the map when centerCoordinates prop changes
    useEffect(() => {
      if (
        map.current &&
        mapLoaded &&
        centerCoordinates &&
        initialAnimationComplete
      ) {
        // If this is just an update to the user's position, smoothly pan to it
        // without the spinning animation
        map.current.flyTo({
          center: centerCoordinates,
          zoom: 16,
          essential: true,
          duration: 1000, // Shorter, smoother transition
        });
      }
    }, [centerCoordinates, mapLoaded, initialAnimationComplete]);

    // Run spinning globe animation only once on initial load
    useEffect(() => {
      // Only run if the map is loaded, coordinates are available, and animation hasn't run yet
      if (
        map.current &&
        mapLoaded &&
        centerCoordinates &&
        !initialAnimationComplete
      ) {
        console.log(
          "Starting initial globe animation with coordinates:",
          centerCoordinates
        );

        // Track if this effect is still relevant (not superseded by a newer effect)
        let isCurrentAnimation = true;

        const spinGlobeAndFly = async () => {
          if (!map.current || !isCurrentAnimation) return;

          try {
            // Store target coordinates to use throughout the animation
            const targetCoords: [number, number] = [
              centerCoordinates[0],
              centerCoordinates[1],
            ];

            // 1. First ensure the map is in 3D globe projection
            map.current.setProjection("globe");

            // 2. Quickly zoom out to see the globe
            await new Promise<void>((resolve) => {
              if (!map.current || !isCurrentAnimation) {
                resolve();
                return;
              }

              map.current.once("moveend", () => resolve());
              map.current.easeTo({
                center: [0, 0], // Center on a neutral point for globe view
                zoom: 0.5, // Far enough to see the whole globe
                duration: 800, // Faster zoom out
                essential: true,
              });
            });

            if (!map.current || !isCurrentAnimation) return;

            // 3. Spin the globe quickly - this is the main visual effect users liked
            // Use a direct rotation approach that completes a full 360° quickly
            await new Promise<void>((resolve) => {
              if (!map.current || !isCurrentAnimation) {
                resolve();
                return;
              }

              const startLng = 0;
              const endLng = 360;
              const duration = 1200; // Fast 1.2 second spin
              const startTime = performance.now();

              // Manual animation function for smooth spinning
              const spin = (time: number) => {
                if (!map.current || !isCurrentAnimation) {
                  resolve();
                  return;
                }

                const elapsed = time - startTime;
                const t = Math.min(elapsed / duration, 1);

                // Fast spin with slight ease-out
                const longitude = startLng + t * (endLng - startLng);
                map.current.setCenter([longitude % 360, 0]);

                if (t < 1) {
                  requestAnimationFrame(spin);
                } else {
                  resolve();
                }
              };

              requestAnimationFrame(spin);
            });

            if (!map.current || !isCurrentAnimation) return;

            // 4. Fly to the target location with a dramatic, graceful animation
            await new Promise<void>((resolve) => {
              if (!map.current || !isCurrentAnimation) {
                resolve();
                return;
              }

              map.current.once("moveend", () => {
                if (isCurrentAnimation) {
                  // Mark animation as complete ONLY after the flyTo animation is done
                  setInitialAnimationComplete(true);
                }
                resolve();
              });

              map.current.flyTo({
                center: targetCoords,
                zoom: 16,
                essential: true,
                duration: 3000, // 3 seconds to fly in - keep this graceful
                curve: 1.5, // More dramatic curve
              });
            });
          } catch (error) {
            console.error("Animation error:", error);
            // In case of any errors, still mark as complete to avoid getting stuck
            if (isCurrentAnimation) {
              setInitialAnimationComplete(true);
            }
          }
        };

        spinGlobeAndFly();

        return () => {
          // Mark this animation as superseded if the effect cleanup runs
          isCurrentAnimation = false;
        };
      }
    }, [mapLoaded, centerCoordinates, initialAnimationComplete]);

    // After initial map initialization, add a backup effect to ensure the map is displayed
    useEffect(() => {
      // Fallback to ensure map appears even if spinning animation can't run
      if (map.current && mapLoaded && !initialAnimationComplete) {
        // If we've waited 5 seconds and still don't have coordinates or animation hasn't completed
        const timeoutId = setTimeout(() => {
          if (!initialAnimationComplete) {
            console.log("Map fallback: Setting initial animation complete");
            setInitialAnimationComplete(true);

            // If we have coordinates, center on them
            if (centerCoordinates) {
              map.current?.flyTo({
                center: centerCoordinates,
                zoom: 16,
                essential: true,
              });
            } else {
              // Otherwise just zoom to a default view
              map.current?.flyTo({
                center: [-74.006, 40.7128], // Default to NYC
                zoom: 10,
                essential: true,
              });
            }
          }
        }, 5000); // Wait 5 seconds before fallback

        return () => clearTimeout(timeoutId);
      }
    }, [mapLoaded, initialAnimationComplete, centerCoordinates]);

    // Add markers when map is loaded and users change
    useEffect(() => {
      if (!map.current || !mapLoaded) return;

      console.log("MapComponent users prop:", users);

      // Performance optimization - if no significant changes in users, skip update
      // This helps prevent expensive DOM operations when the users array recreates unnecessarily
      const hasSignificantChanges = users.some((user) => {
        const marker = markersRef.current[user.id];

        // If no marker exists, this is a new user
        if (!marker) return true;

        // If coordinates have changed significantly, update is needed
        const currentPos = marker.getLngLat();
        const newPos = user.coordinates;

        const hasMoved =
          Math.abs(currentPos.lng - newPos[0]) > 0.0001 ||
          Math.abs(currentPos.lat - newPos[1]) > 0.0001;

        return hasMoved;
      });

      // If no significant changes and all existing markers are still valid, skip update
      const allMarkersStillValid = Object.keys(markersRef.current).every((id) =>
        users.some((user) => user.id === Number(id))
      );

      if (
        !hasSignificantChanges &&
        allMarkersStillValid &&
        Object.keys(markersRef.current).length === users.length
      ) {
        return;
      }

      // Track markers to remove (markers for users who no longer exist)
      const userIdsToDisplay = new Set(users.map((user) => user.id));
      const markersToRemove = Object.keys(markersRef.current).filter(
        (id) => !userIdsToDisplay.has(Number(id))
      );

      // Remove markers for users who no longer exist
      markersToRemove.forEach((id) => {
        markersRef.current[Number(id)]?.remove();
        delete markersRef.current[Number(id)];
      });

      // Update or create markers for current users
      users.forEach((user) => {
        const existingMarker = markersRef.current[user.id];

        if (existingMarker) {
          // Update existing marker position
          existingMarker.setLngLat(user.coordinates);
        } else {
          // Create new marker for new user
          const markerEl = document.createElement("div");
          markerEl.className = "relative z-[999]";
          const root = createRoot(markerEl);

          root.render(
            <UserAvatar
              position={{ top: "50%", left: "50%" }}
              image={user.avatar}
              name={user.name}
              distance={user.distance}
              isUser={user.isUser}
            />
          );

          const marker = new mapboxgl.Marker({
            element: markerEl,
            anchor: "center",
          })
            .setLngLat(user.coordinates)
            .addTo(map.current!);

          markersRef.current[user.id] = marker;
        }
      });
    }, [users, mapLoaded]);

    // Add business markers when map is loaded and businesses change
    useEffect(() => {
      if (!map.current || !mapLoaded || !initialAnimationComplete) return;

      console.log("MapComponent businesses prop:", businesses);
      console.log(
        "Map loaded:",
        mapLoaded,
        "Animation complete:",
        initialAnimationComplete
      );

      // Check if businesses array is empty or undefined
      if (!businesses || businesses.length === 0) {
        console.log("No businesses to display on map");
        return;
      }

      // Track business IDs to display
      const businessIdsToDisplay = new Set(
        businesses.map((business) => business.id)
      );

      console.log("Business IDs to display:", Array.from(businessIdsToDisplay));

      // Remove markers for businesses that no longer exist
      const markersToRemove = Object.keys(businessMarkersRef.current).filter(
        (id) => !businessIdsToDisplay.has(id)
      );

      markersToRemove.forEach((id) => {
        businessMarkersRef.current[id]?.remove();
        delete businessMarkersRef.current[id];
      });

      // Update or create markers for current businesses
      businesses.forEach((business) => {
        console.log(
          "Creating/updating marker for business:",
          business.name,
          business.coordinates
        );
        const existingMarker = businessMarkersRef.current[business.id];

        if (existingMarker) {
          // Update existing marker position
          existingMarker.setLngLat(business.coordinates);
          console.log("Updated existing marker for:", business.name);
        } else {
          // Create business marker element
          const markerEl = document.createElement("div");
          markerEl.className =
            "w-10 h-10 rounded-full bg-gray-800 border-2 border-purple-500 flex items-center justify-center z-[1000] overflow-hidden shadow-lg cursor-pointer touch-manipulation";

          const root = createRoot(markerEl);
          root.render(
            <div className="flex items-center justify-center w-full h-full">
              {business.logo ? (
                <img
                  src={business.logo}
                  alt={business.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-gray-800 text-white">
                  <Store className="h-5 w-5 text-purple-400" />
                </div>
              )}
            </div>
          );

          // Create the marker
          const marker = new mapboxgl.Marker({
            element: markerEl,
            anchor: "bottom",
          })
            .setLngLat(business.coordinates)
            .addTo(map.current!);

          // Create popup with business info for click
          const popup = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,
            offset: 25,
            className: "business-popup",
            maxWidth: "220px",
            anchor: "bottom",
            closeOnMove: false,
          });

          // Create HTML content for popup
          const popupContent = document.createElement("div");
          popupContent.className = "p-0";

          const popupRoot = createRoot(popupContent);
          popupRoot.render(
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                {business.logo && (
                  <img
                    src={business.logo}
                    alt={business.name}
                    className="w-8 h-8 rounded-full object-cover border border-gray-700"
                  />
                )}
                <div className="font-bold text-sm text-white">
                  {business.name}
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                {business.description}
              </p>
              <button
                className="w-full py-1.5 px-3 bg-purple-700 text-white rounded text-xs hover:bg-purple-600 transition-colors font-medium"
                onClick={() => onBusinessClick?.(business)}
              >
                Join Chat
              </button>
            </div>
          );

          popup.setDOMContent(popupContent);

          // Add click event to marker element
          markerEl.addEventListener("click", (e) => {
            e.stopPropagation();
            // Show popup with dark background when marker is clicked
            popup.setLngLat(business.coordinates).addTo(map.current!);
          });

          // Add touch events for better mobile support
          markerEl.addEventListener(
            "touchstart",
            (e) => {
              e.stopPropagation();
            },
            { passive: true }
          );

          markerEl.addEventListener("touchend", (e) => {
            e.stopPropagation();
            // Show popup with dark background when marker is touched
            popup.setLngLat(business.coordinates).addTo(map.current!);
          });

          businessMarkersRef.current[business.id] = marker;
        }
      });
    }, [businesses, mapLoaded, initialAnimationComplete, onBusinessClick]);

    // Use geolocationError prop for error display
    if (geolocationError) {
      return (
        <div className="flex items-center justify-center h-full bg-black/20 backdrop-blur-sm rounded-xl">
          <div className="text-purple-300 text-sm flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
            {geolocationError}
          </div>
        </div>
      );
    }

    return <div ref={mapContainer} className="w-full h-full" />;
  },
  (prevProps, nextProps) => {
    // Custom comparison function for memo to prevent unnecessary re-renders

    // Always re-render if businesses changed
    if (
      JSON.stringify(prevProps.businesses) !==
      JSON.stringify(nextProps.businesses)
    ) {
      console.log("Businesses changed, forcing re-render");
      return false; // Not equal, re-render
    }

    // If error state changed, we should re-render
    if (prevProps.geolocationError !== nextProps.geolocationError) {
      return false; // Not equal, so re-render
    }

    // Skip re-render for small coordinate changes (less than ~10 meters)
    if (prevProps.centerCoordinates && nextProps.centerCoordinates) {
      const [prevLon, prevLat] = prevProps.centerCoordinates;
      const [nextLon, nextLat] = nextProps.centerCoordinates;

      // Only re-render if position changed by more than a small epsilon
      const positionChangedSignificantly =
        Math.abs(prevLon - nextLon) > 0.0001 ||
        Math.abs(prevLat - nextLat) > 0.0001;

      if (!positionChangedSignificantly) {
        // Position didn't change significantly, now check users and businesses

        // If users length is different, definitely need to update
        if (prevProps.users.length !== nextProps.users.length) {
          return false; // Not equal, so re-render
        }

        // Check if any user coordinates changed significantly
        const usersChangedSignificantly = nextProps.users.some(
          (user, index) => {
            const prevUser = prevProps.users[index];
            if (prevUser.id !== user.id) return true;

            const [prevLon, prevLat] = prevUser.coordinates;
            const [nextLon, nextLat] = user.coordinates;

            return (
              Math.abs(prevLon - nextLon) > 0.0001 ||
              Math.abs(prevLat - nextLat) > 0.0001
            );
          }
        );

        if (!usersChangedSignificantly) {
          return true; // Props are equal enough, skip render
        }
      }
    }

    // For null values or other cases, use default comparison
    return false; // Not equal, so re-render
  }
);

export default MapComponent;
