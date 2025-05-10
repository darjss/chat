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

// Custom marker icon with modern design
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

// Custom loading spinner component
function LoadingSpinner() {
  return (
    <div className="bg-white bg-opacity-90 p-5 rounded-xl shadow-lg flex items-center space-x-3 backdrop-blur-sm border border-indigo-100">
      <div className="animate-spin rounded-full h-6 w-6 border-4 border-indigo-500 border-t-transparent"></div>
      <span className="text-indigo-700 font-medium">
        Getting your location...
      </span>
    </div>
  );
}

// Error display component
function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="bg-white bg-opacity-90 p-5 rounded-xl shadow-lg flex items-center backdrop-blur-sm border-l-4 border-red-500">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 text-red-500 mr-2"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span className="text-red-700">{message}</span>
    </div>
  );
}

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
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000]">
        {error ? <ErrorDisplay message={error} /> : <LoadingSpinner />}
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
        <Popup className="map-custom-popup">
          <div className="p-1">
            <div className="font-medium text-indigo-800 mb-1 text-center border-b pb-1 border-indigo-100">
              Location Details
            </div>
            <div className="text-sm">
              <div className="flex items-center mb-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-indigo-500 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  {position[0].toFixed(6)}, {position[1].toFixed(6)}
                </span>
              </div>
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-purple-500 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
                <span className="font-mono text-xs bg-purple-50 px-2 py-1 rounded-md">
                  {geohash}
                </span>
              </div>
            </div>
            <div className="text-xs text-center mt-2 text-gray-500">
              Drag marker to adjust location
            </div>
          </div>
        </Popup>
      </Marker>
      {bounds && (
        <Rectangle
          bounds={bounds}
          pathOptions={{
            color: "#6366F1", // Indigo-500
            weight: 2,
            fillOpacity: 0.1,
            dashArray: "5, 5",
            fillColor: "#818CF8", // Indigo-400
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
    <div className="h-[400px] w-full relative group">
      {/* Map overlay with instructions */}
      <div className="absolute top-4 left-4 z-[1000] bg-white bg-opacity-80 backdrop-blur-sm p-2 rounded-lg shadow-md border border-indigo-100 text-xs text-indigo-800 transition-opacity duration-300 opacity-80 group-hover:opacity-0 pointer-events-none">
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1 text-indigo-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          Drag marker to select location
        </div>
      </div>

      <MapContainer
        center={[0, 0]}
        zoom={2}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        className="rounded-lg"
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

      {/* Custom map controls */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        <div className="bg-white rounded-lg shadow-md flex flex-col p-1">
          <button
            className="hover:bg-indigo-50 p-2 rounded transition-colors"
            onClick={() => {
              // Re-trigger geolocation
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    // This will be handled by the LocationMarker component
                  },
                  (err) => {
                    console.error("Geolocation error:", err);
                  }
                );
              }
            }}
            title="Return to my location"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-indigo-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Add global CSS for map customization
const styleElement = document.createElement("style");
styleElement.textContent = `
  .leaflet-popup-content-wrapper {
    border-radius: 12px;
    padding: 0;
    overflow: hidden;
  }
  .leaflet-popup-content {
    margin: 0;
    min-width: 200px;
  }
  .leaflet-container a.leaflet-popup-close-button {
    color: #4f46e5;
    padding: 8px;
  }
  .leaflet-control-zoom a {
    border-radius: 8px !important;
    color: #4f46e5 !important;
  }
`;
document.head.appendChild(styleElement);
