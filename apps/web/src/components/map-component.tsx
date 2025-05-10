"use client";

import { useEffect, useRef, useState } from "react";
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

export default function MapComponent({
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

      const spinGlobeAndFly = async () => {
        if (!map.current) return;

        // 1. Zoom out to see the globe
        map.current.easeTo({
          center: [0, 0], // Center on a neutral point for globe view
          zoom: 0.5,
          duration: 1000, // 1 second to zoom out
          essential: true,
        });

        // Wait for zoom out to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 2. Spin the globe
        const spinDuration = 1500; // 1.5 seconds for spinning
        const revolutions = 1;
        const startTime = performance.now();

        const spin = (timestamp: number) => {
          if (!map.current) return;
          const elapsedTime = timestamp - startTime;
          if (elapsedTime < spinDuration) {
            const rotation = (elapsedTime / spinDuration) * 360 * revolutions;
            map.current.setCenter([rotation % 360, 0]); // Rotate by changing longitude
            requestAnimationFrame(spin);
          } else {
            // 3. Fly to the target location
            if (map.current && centerCoordinates) {
              // Re-check centerCoordinates
              map.current.flyTo({
                center: centerCoordinates,
                zoom: 16,
                essential: true,
                duration: 3000, // 3 seconds to fly in
              });

              // Mark animation as complete
              setInitialAnimationComplete(true);
            }
          }
        };
        requestAnimationFrame(spin);
      };

      spinGlobeAndFly();
    }
  }, [mapLoaded, centerCoordinates, initialAnimationComplete]); // Dependencies include centerCoordinates and initialAnimationComplete

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

    // Remove existing markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    console.log("MapComponent users prop:", users);

    // Create markers for all users
    users.forEach((user) => {
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
}
