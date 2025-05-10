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
  // Removed userLocation and error state here

  // Geolocation useEffect has been removed from here

  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-74.006, 40.7128], // Default center, will be updated by flyTo
      zoom: 12, // Adjusted default zoom
      attributionControl: false,
      logoPosition: "bottom-left",
    });

    map.current.on("load", () => {
      setMapLoaded(true);
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
    if (map.current && mapLoaded && centerCoordinates) {
      map.current.flyTo({
        center: centerCoordinates,
        zoom: 16, // Zoom in when user location is available
        essential: true,
      });
    }
  }, [centerCoordinates, mapLoaded]);

  // Add markers when map is loaded and users change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    console.log("MapComponent users prop:", users);

    const currentUser = users.find((u) => u.isUser);

    console.log("MapComponent currentUser:", currentUser);

    if (currentUser) {
      const markerEl = document.createElement("div");
      markerEl.className = "relative z-[999]";
      const root = createRoot(markerEl);

      root.render(
        <UserAvatar
          position={{ top: "50%", left: "50%" }}
          image={currentUser.avatar}
          name={currentUser.name}
          distance={currentUser.distance}
          isUser={currentUser.isUser}
        />
      );

      const marker = new mapboxgl.Marker({
        element: markerEl,
        anchor: "center",
      })
        .setLngLat(currentUser.coordinates)
        .addTo(map.current!);

      markersRef.current[currentUser.id] = marker;
    }
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
