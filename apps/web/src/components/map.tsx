import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Rectangle,
  useMap,
  ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "leaflet";
import { useEffect, useState, useCallback } from "react";
import ngeohash from "ngeohash";

// Fix for default marker icon
const icon = new Icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function LocationMarker({
  onLocationSelect,
  precision = 6,
}: {
  onLocationSelect: (lat: number, lng: number, geohash: string) => void;
  precision?: number;
}) {
  const map = useMap();
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [geohash, setGeohash] = useState<string>("");
  const [bounds, setBounds] = useState<
    [[number, number], [number, number]] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  // Memoize updatePosition to prevent unnecessary re-renders
  const updatePosition = useCallback(
    (lat: number, lng: number) => {
      const pos: [number, number] = [lat, lng];
      setPosition(pos);
      map.setView(pos, map.getZoom() || 18);

      const hash = ngeohash.encode(lat, lng, precision);
      setGeohash(hash);
      // Store the new geohash in localStorage
      localStorage.setItem("currentGeohash", hash);

      const bbox = ngeohash.decode_bbox(hash);
      setBounds([
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ]);
      onLocationSelect(lat, lng, hash);
      setError(null);
    },
    [map, precision, onLocationSelect]
  );

  // Effect for geolocation tracking
  useEffect(() => {
    if (navigator.geolocation) {
      // Try to get position with a shorter timeout first
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updatePosition(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.error("Initial geolocation error:", err);
          setError("Getting your location...");
          // Fallback to a less accurate position if high accuracy times out
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              updatePosition(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
              console.error("Fallback geolocation error:", err);
              setError(
                "Unable to get your location. Please check your location settings."
              );
            },
            {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 0,
            }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );

      // Watch position with less strict settings
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          updatePosition(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.error("Geolocation watch error:", err);
          setError(
            "Location tracking paused. Please check your location settings."
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000, // Allow some caching to prevent timeouts
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [updatePosition]);

  // Effect for periodic geohash comparison
  useEffect(() => {
    // Initial check for stored geohash
    const storedGeohash = localStorage.getItem("currentGeohash");
    if (storedGeohash && storedGeohash !== geohash && position) {
      // If there's a mismatch, update to current position
      updatePosition(position[0], position[1]);
    }

    // Set up interval for checking geohash
    const intervalId = setInterval(() => {
      const storedGeohash = localStorage.getItem("currentGeohash");
      if (storedGeohash && storedGeohash !== geohash && position) {
        // If there's a mismatch, update to current position
        updatePosition(position[0], position[1]);
      }
    }, 10000); // Check every 10 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [geohash, position, updatePosition]);

  const handleMarkerDrag = (e: any) => {
    const newPos = e.target.getLatLng();
    const lat = newPos.lat;
    const lng = newPos.lng;
    setPosition([lat, lng]);

    const hash = ngeohash.encode(lat, lng, precision);
    setGeohash(hash);
    const bbox = ngeohash.decode_bbox(hash);
    setBounds([
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ]);
    onLocationSelect(lat, lng, hash);
    setError(null);
  };

  if (!position) {
    return (
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-lg shadow-lg z-[1000]">
        {error || "Getting your location..."}
      </div>
    );
  }

  return (
    <>
      <Marker
        position={position}
        icon={icon}
        draggable={true}
        eventHandlers={{
          dragend: handleMarkerDrag,
        }}
      >
        <Popup>
          <div>
            <p>
              Location: {position[0].toFixed(6)}, {position[1].toFixed(6)}
            </p>
            <p>Geohash: {geohash}</p>
          </div>
        </Popup>
      </Marker>
      {bounds && (
        <Rectangle
          bounds={bounds}
          pathOptions={{
            color: "#3388ff",
            weight: 2,
            fillOpacity: 0.1,
          }}
        />
      )}
    </>
  );
}

interface MapProps {
  onLocationSelect?: (lat: number, lng: number, geohash: string) => void;
  precision?: number;
}

export default function Map({
  onLocationSelect = () => {},
  precision = 6,
}: MapProps) {
  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden">
      <MapContainer
        center={[0, 0]}
        zoom={2}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="bottomright" />
        <LocationMarker
          onLocationSelect={onLocationSelect}
          precision={precision}
        />
      </MapContainer>
    </div>
  );
}
