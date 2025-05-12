import type { Route } from "./+types/_index";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useNavigate } from "react-router";

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 `;

export function meta({}: Route.MetaArgs) {
  return [{ title: "My App" }, { name: "description", content: "My App" }];
}

export default function Home() {
  // const healthCheck = useQuery(trpc.healthCheck.queryOptions());
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Business registration mutation
  const registerBusiness = useMutation(
    trpc.business.register.mutationOptions()
  );

  // Nearby businesses query
  const nearbyBusinesses = useQuery({
    ...trpc.business.getNearby.queryOptions({
      latitude: location?.latitude as number, // Default to a location in Mongolia
      longitude: location?.longitude as number,
      radius: 1000, // 1km radius
    }),
    enabled: true, // Start with default location
  });

  // Function to register all businesses
  const handleRegisterBusinesses = async () => {
    try {
      // for (const business of staticBusinesses) {
      //   await registerBusiness.mutateAsync(business);
      // }
      alert("3 businesses registered successfully!");
    } catch (error) {
      console.error("Failed to register businesses:", error);
      alert("Failed to register businesses. See console for details.");
    }
  };

  // Function to get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Couldn't get your location. Using default location.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  // Redirect based on auth status
  useEffect(() => {
    if (!isPending) {
      if (session) {
        // User is authenticated, redirect to chat
        navigate("/chat");
      } else {
        // User is not authenticated, redirect to login
        navigate("/login");
      }
    }
  }, [session, isPending, navigate]);

  // Show loading screen while checking auth
  if (isPending) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <pre className="overflow-x-auto font-mono text-sm">{TITLE_TEXT}</pre>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  // This will only be shown briefly before redirect happens
  return (
    <div className="container mx-auto max-w-3xl px-4 py-2">
      <pre className="overflow-x-auto font-mono text-sm">{TITLE_TEXT}</pre>
      <div className="grid gap-6">
        {/* <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">API Status</h2>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                healthCheck.data ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {healthCheck.isLoading
                ? "Checking..."
                : healthCheck.data
                ? "Connected"
                : "Disconnected"}
            </span>
          </div>
        </section> */}

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Business Management</h2>
          <button
            onClick={handleRegisterBusinesses}
            disabled={registerBusiness.isPending}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-400"
          >
            {registerBusiness.isPending
              ? "Registering..."
              : "Register 3 Sample Businesses"}
          </button>
          {registerBusiness.isError && (
            <p className="mt-2 text-sm text-red-500">
              Error:{" "}
              {registerBusiness.error?.message ||
                "Failed to register businesses"}
            </p>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-medium">Nearby Businesses</h2>
            <button
              onClick={getCurrentLocation}
              className="rounded bg-green-500 px-3 py-1 text-white text-sm hover:bg-green-600"
            >
              Use My Location
            </button>
          </div>

          {nearbyBusinesses.isLoading ? (
            <p className="text-sm text-gray-500">
              Loading nearby businesses...
            </p>
          ) : nearbyBusinesses.isError ? (
            <p className="text-sm text-red-500">
              Error loading businesses: {nearbyBusinesses.error.message}
            </p>
          ) : nearbyBusinesses.data?.length === 0 ? (
            <p className="text-sm text-gray-500">No businesses found nearby</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 mt-2">
              {nearbyBusinesses.data?.map((business) => (
                <div
                  key={business.id}
                  className="border rounded-lg p-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-100 rounded-md">
                      {business.logo.startsWith("http") ? (
                        <img
                          src={business.logo}
                          alt={business.name}
                          className="w-10 h-10 object-contain"
                        />
                      ) : (
                        <span className="text-2xl">{business.logo}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{business.name}</h3>
                      <p className="text-sm text-gray-600">
                        {business.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        ({business.coordinates[1].toFixed(6)},{" "}
                        {business.coordinates[0].toFixed(6)})
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
