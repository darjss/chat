"use client";

import { useEffect, useRef, useState, memo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createRoot } from "react-dom/client";
import UserAvatar from "./user-avatar";

// This would normally come from an environment variable
// For demo purposes, we're using a public token
const MAPBOX_TOKEN =
  "pk.eyJ1Ijoic291bmRicnVoIiwiYSI6ImNtYWlmeW8zODA2NW8yanM3NTVrbnZicHUifQ.zAlsz8FbfH8N4sUadaCylA";

interface User {
  id: number;
  name: string;
  avatar: string;
  coordinates: [number, number];
  distance?: string;
  isUser?: boolean;
}

interface MapComponentProps {
  users: User[];
  centerCoordinates: [number, number] | null; // New prop
  geolocationError: string | null; // New prop
}

const MapComponent = memo(
  function MapComponent({
    users,
    centerCoordinates,
    geolocationError,
  }: MapComponentProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<{ [key: number]: mapboxgl.Marker }>({});
    const [mapLoaded, setMapLoaded] = useState(false);
    const [initialAnimationComplete, setInitialAnimationComplete] =
      useState(false);

    // Add a ref to track the previous centerCoordinates to minimize redraws
    const prevCenterCoordinates = useRef<[number, number] | null>(null);

    // Add a ref to track the previous users to minimize redraws
    const prevUsers = useRef<User[]>([]);

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
        // Position didn't change significantly, now check users

        // If length is different, definitely need to update
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
