import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import ngeohash from "ngeohash";
import { authClient } from "@/lib/auth-client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Smile,
  Paperclip,
  MapPin,
  Users,
  Menu,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import MapComponent from "@/components/map-component";
import ChatMessage from "@/components/chat-message";
import { useMobile } from "@/hooks/use-mobile";

// Custom hook for deep comparison
function useDeepCompareMemoize<T>(value: T): T {
  const ref = useRef<T | undefined>(undefined);

  // Only update the ref if the value has changed significantly
  // Using a simplistic deep comparison that works for our use case
  if (!ref.current || !deepEqual(value, ref.current)) {
    ref.current = value;
  }

  return ref.current;
}

// Simple deep equality comparison for our specific use case
function deepEqual(obj1: any, obj2: any): boolean {
  // Compare arrays of user objects
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;

    // Create maps for faster comparison
    const map1 = new Map();
    obj1.forEach((user) => {
      if (user && typeof user === "object" && "id" in user) {
        map1.set(user.id, user);
      }
    });

    // Check if all users in obj2 have equivalent data in obj1
    return obj2.every((user) => {
      if (!user || typeof user !== "object" || !("id" in user)) return false;
      const user1 = map1.get(user.id);
      if (!user1) return false;

      // Check essential properties
      return (
        user1.name === user.name &&
        user1.avatar === user.avatar &&
        Array.isArray(user1.coordinates) &&
        Array.isArray(user.coordinates) &&
        user1.coordinates.length === 2 &&
        user.coordinates.length === 2 &&
        // Use small epsilon for float comparison
        Math.abs(user1.coordinates[0] - user.coordinates[0]) < 0.0001 &&
        Math.abs(user1.coordinates[1] - user.coordinates[1]) < 0.0001
      );
    });
  }

  return false;
}

// Memoize icon components to prevent recreating them on every render
const MemoizedSend = memo(Send);
const MemoizedSmile = memo(Smile);
const MemoizedPaperclip = memo(Paperclip);
const MemoizedMapPin = memo(MapPin);
const MemoizedChevronUp = memo(ChevronUp);
const MemoizedChevronDown = memo(ChevronDown);

// Storage keys
const GEOHASH_STORAGE_KEY = "chat_geohash";

interface User {
  id: string;
  name: string;
  avatar: string;
  coordinates: [number, number];
}

// Interface to match what the MapComponent expects
interface MapUser {
  id: number;
  name: string;
  avatar: string;
  coordinates: [number, number];
  distance?: string;
  isUser?: boolean;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: User;
}

// Memoized message list component
const MessageList = memo(
  ({
    messages,
    session,
    formatTime,
  }: {
    messages: Message[];
    session: any;
    formatTime: (date: string) => string;
  }) => {
    return (
      <>
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            avatar={msg.user.avatar || "/placeholder.svg"}
            name={msg.user.name}
            message={msg.content}
            time={formatTime(msg.createdAt)}
            distance="nearby"
            isIncoming={msg.user.id !== session?.user?.id}
            isSystem={msg.user.id === "system"}
          />
        ))}
      </>
    );
  }
);

function ChatPage() {
  const isMobile = useMobile();
  const [mapExpanded, setMapExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [geohash, setGeohash] = useState<string | null>(null);
  const [currentUserCoordinates, setCurrentUserCoordinates] = useState<
    [number, number] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousUsers = useRef<User[]>([]);
  const navigate = useNavigate();

  // Important optimization: store the last known position to avoid frequent state updates
  const lastKnownPosition = useRef<{
    coords: [number, number];
    timestamp: number;
  } | null>(null);

  // Minimum distance in meters needed to trigger a coordinate update
  const MIN_DISTANCE_CHANGE = 5; // meters

  // Minimum time between updates
  const MIN_TIME_BETWEEN_UPDATES = 5000; // 5 seconds

  // Helper to calculate distance between coordinates in meters
  const getDistanceInMeters = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    // Haversine formula for distance calculation
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const { data: session, isPending } = authClient.useSession();

  // Add this effect to handle authentication
  useEffect(() => {
    if (!session && !isPending) {
      toast.error("Please sign in to access this page");
      navigate("/login");
    }
  }, [session, isPending, navigate]);

  // Load cached geohash on initial render
  useEffect(() => {
    const cachedGeohash = localStorage.getItem(GEOHASH_STORAGE_KEY);
    if (cachedGeohash) {
      setGeohash(cachedGeohash);
    }
  }, []);

  // When geohash changes, save to local storage
  useEffect(() => {
    if (geohash) {
      localStorage.setItem(GEOHASH_STORAGE_KEY, geohash);
    }
  }, [geohash]);

  const handleLocationSelect = (lat: number, lng: number, hash: string) => {
    // Compare with current geohash before setting
    if (hash !== geohash) {
      setGeohash(hash);
      setError(null);
    }
  };

  const precision = 6;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coordinates: [number, number] = [
            pos.coords.longitude,
            pos.coords.latitude,
          ];
          setCurrentUserCoordinates(coordinates);

          // Generate new hash based on current coordinates
          const newHash = ngeohash.encode(
            pos.coords.latitude,
            pos.coords.longitude,
            precision
          );

          // Check if the geohash is significantly different (different chat room)
          const cachedGeohash = localStorage.getItem(GEOHASH_STORAGE_KEY);

          if (!cachedGeohash) {
            // No cached geohash, set the new one
            setGeohash(newHash);
            localStorage.setItem(GEOHASH_STORAGE_KEY, newHash);
          } else if (cachedGeohash !== newHash) {
            // Significant location change detected
            // For now, we'll keep using the cached geohash unless the user explicitly changes it
            // This prevents accidentally switching chat rooms when the user moves slightly
            setGeohash(cachedGeohash);

            // Optionally, you could show a notification to the user that their location has changed
            // and give them the option to switch to the new chat room
            console.log("Location changed significantly. Using cached room.");
          } else {
            // Same geohash, continue using it
            setGeohash(cachedGeohash);
          }

          setError(null);
        },
        (err) => {
          console.error("Initial geolocation error:", err);
          setError("Getting your location...");

          // Fallback geolocation attempt
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const coordinates: [number, number] = [
                pos.coords.longitude,
                pos.coords.latitude,
              ];
              setCurrentUserCoordinates(coordinates);

              // Generate new hash with fallback coordinates
              const newHash = ngeohash.encode(
                pos.coords.latitude,
                pos.coords.longitude,
                precision
              );

              // Check against cached geohash
              const cachedGeohash = localStorage.getItem(GEOHASH_STORAGE_KEY);

              if (!cachedGeohash) {
                setGeohash(newHash);
                localStorage.setItem(GEOHASH_STORAGE_KEY, newHash);
              } else if (cachedGeohash !== newHash) {
                // Use cached geohash to maintain chat room
                setGeohash(cachedGeohash);
              } else {
                setGeohash(cachedGeohash);
              }

              setError(null);
            },
            (errFallback) => {
              console.error("Fallback geolocation error:", errFallback);

              // If we can't get location but have a cached geohash, use it
              const cachedGeohash = localStorage.getItem(GEOHASH_STORAGE_KEY);
              if (cachedGeohash) {
                setGeohash(cachedGeohash);
                setError(
                  "Using last known location. Location services unavailable."
                );
              } else {
                setError(
                  "Unable to get your location. Please check your location settings."
                );
              }
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
          );
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );

      // Important optimization: store the last known position to avoid frequent state updates
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coordinates: [number, number] = [
            pos.coords.longitude,
            pos.coords.latitude,
          ];

          // Check if we should update state based on distance moved and time passed
          const shouldUpdate = () => {
            if (!lastKnownPosition.current) return true;

            const timeSinceLastUpdate =
              Date.now() - lastKnownPosition.current.timestamp;
            if (timeSinceLastUpdate < MIN_TIME_BETWEEN_UPDATES) return false;

            const [prevLon, prevLat] = lastKnownPosition.current.coords;
            const [newLon, newLat] = coordinates;

            const distance = getDistanceInMeters(
              prevLat,
              prevLon,
              newLat,
              newLon
            );
            return distance > MIN_DISTANCE_CHANGE;
          };

          // Only update state if needed
          if (shouldUpdate()) {
            console.log("Updating position - significant movement detected");

            // Update local state
            setCurrentUserCoordinates(coordinates);

            // Save this position
            lastKnownPosition.current = {
              coords: coordinates,
              timestamp: Date.now(),
            };

            // Set error to null if previously had error
            if (error) setError(null);
          }
        },
        (err) => {
          console.error("Geolocation watch error:", err);
          setError(
            "Location tracking paused. Please check your location settings."
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      const cachedGeohash = localStorage.getItem(GEOHASH_STORAGE_KEY);
      if (cachedGeohash) {
        setGeohash(cachedGeohash);
        setError("Using cached location. Geolocation not supported.");
      } else {
        setError("Geolocation is not supported by your browser.");
      }
    }
  }, [precision, geohash, ws, session, error]);

  // Toggle map expansion on mobile with useCallback
  const toggleMap = useCallback(() => {
    setMapExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    // Scroll to bottom whenever messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!geohash) return;

    if (ws.current) {
      console.log("Closing WebSocket connection123456");
      ws.current.close();
    }

    const connectWebSocket = () => {
      // Construct WebSocket URL based on your server setup
      // Assuming your WebSocket server is at /chat-room/:geohash
      // And your server is running on the same host or you have a proxy
      const wsUrl = `${import.meta.env.VITE_SERVER_URL.replace(
        "http",
        "ws"
      )}/chat-room/${geohash}`;

      try {
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          console.log("WebSocket connected");
          setError(null);

          // Send user data when connection is established
          if (ws.current && session?.user) {
            const userData: User = {
              id:
                session.user.id || Math.random().toString(36).substring(2, 15),
              name: session.user.name || "Anonymous",
              avatar: session.user.image || "/placeholder.svg",
              coordinates: currentUserCoordinates || [0, 0],
            };

            ws.current.send(
              JSON.stringify({
                type: "user",
                data: userData,
              })
            );
          }
        };

        ws.current.onmessage = (event) => {
          const data = JSON.parse(event.data as string);
          if (data.type === "history") {
            setMessages(data.messages);
          } else if (data.type === "users") {
            // Parse the users string to a User[] array
            try {
              const parsedUsers = JSON.parse(data.users);
              console.log("Received users from server:", parsedUsers);
              setUsers(parsedUsers);
            } catch (e) {
              console.error("Error parsing users:", e);
            }
          } else if (data.content && data.user && data.createdAt && data.id) {
            // Check if it's a new message
            setMessages((prevMessages) => [...prevMessages, data]);
          }
        };

        ws.current.onerror = (error) => {
          console.error("WebSocket error:", error);
          setError("WebSocket connection error. Please try refreshing.");
        };

        ws.current.onclose = () => {
          console.log("WebSocket disconnected");
          // Optionally, you can try to reconnect here or notify the user
        };
      } catch (e) {
        console.error("Failed to connect to WebSocket:", e);
        setError(
          "Failed to establish chat connection. Ensure the server is running and accessible."
        );
      }
    };

    connectWebSocket();

    return () => {
      if (ws.current) {
        console.log("clean up");
        ws.current.close();
      }
    };
  }, [geohash, session]);

  // Memoize the sendMessage function
  const sendMessage = useCallback(() => {
    if (
      newMessage.trim() &&
      ws.current &&
      ws.current.readyState === WebSocket.OPEN &&
      session?.user
    ) {
      const randomId = Math.random().toString(36).substring(2, 15);
      const messageData = {
        type: "message",
        data: {
          id: new Date().toISOString() + randomId + "-" + session?.user?.name,
          content: newMessage,
          createdAt: new Date().toISOString(),
          user: {
            id: session.user.id || randomId,
            name: session.user.name || "Anonymous",
            avatar: session.user.image || "/placeholder.svg",
            coordinates: currentUserCoordinates || [0, 0],
          },
        },
      };
      ws.current.send(JSON.stringify(messageData));
      setNewMessage("");
    }
  }, [newMessage, ws, session, currentUserCoordinates]);

  // Extract message input handler to useCallback
  const handleMessageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewMessage(e.target.value);
    },
    []
  );

  // Extract and memoize the keypress handler
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        sendMessage();
      }
    },
    [sendMessage]
  );

  // Memoize the formatTime function
  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  // Create a computed users array that matches what MapComponent expects
  const mapUsers = useMemo((): MapUser[] => {
    if (!geohash || !session?.user) return [];

    // Find current user in the users array if it exists
    const existingUser = users.find((user) => user.id === session.user?.id);

    // Current user with actual coordinates from state
    const currentUser: MapUser = {
      id: 1, // Use numeric ID for map component
      name: session?.user?.name || "You",
      avatar: session?.user?.image || "/placeholder.svg",
      // Use the user's actual coordinates from the server if available, otherwise fall back to local state
      coordinates: (existingUser?.coordinates ||
        currentUserCoordinates || [0, 0]) as [number, number],
      isUser: true,
      distance: "nearby",
    };

    // Only include other users (exclude current user to avoid duplication)
    const otherUsers: MapUser[] = users
      .filter((user) => user.id !== session.user?.id)
      .map((user, index) => ({
        id: index + 2, // Start at 2 since current user is 1
        name: user.name,
        avatar: user.avatar || "/placeholder.svg",
        coordinates: user.coordinates || [0, 0],
        distance: "nearby",
      }));

    return [currentUser, ...otherUsers];
  }, [geohash, users, session?.user, currentUserCoordinates]);

  // Type for our MapComponent props
  type MapComponentProps = {
    users: MapUser[];
    centerCoordinates: [number, number] | null;
    geolocationError: string | null;
  };

  // Further stabilize the props for MapComponent - compute the props first
  const mapPropsValue = useMemo<MapComponentProps>(
    () => ({
      users: mapUsers,
      centerCoordinates: currentUserCoordinates,
      geolocationError: error,
    }),
    [mapUsers, currentUserCoordinates, error]
  );

  // Then use deep comparison to avoid recreating object when nothing significant changed
  const stableMapProps = useDeepCompareMemoize(mapPropsValue);

  // Update user coordinates on the server whenever they change
  useEffect(() => {
    if (
      ws.current &&
      ws.current.readyState === WebSocket.OPEN &&
      session?.user &&
      currentUserCoordinates
    ) {
      // Send updated coordinates
      const userData: User = {
        id: session.user.id || Math.random().toString(36).substring(2, 15),
        name: session.user.name || "Anonymous",
        avatar: session.user.image || "/placeholder.svg",
        coordinates: currentUserCoordinates,
      };

      // Only send if we have actual coordinates and they've changed significantly
      if (currentUserCoordinates[0] !== 0 || currentUserCoordinates[1] !== 0) {
        // Add debouncing to avoid frequent updates
        const timeoutId = setTimeout(() => {
          ws.current?.send(
            JSON.stringify({
              type: "user",
              data: userData,
            })
          );
        }, 200); // 200ms debounce

        return () => clearTimeout(timeoutId);
      }
    }
  }, [currentUserCoordinates, session, ws]);

  // Optimize send button disabled state with useMemo
  const isSendDisabled = useMemo(() => {
    return (
      !ws.current ||
      ws.current.readyState !== WebSocket.OPEN ||
      !newMessage.trim()
    );
  }, [ws.current?.readyState, newMessage]);

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-gray-900 via-purple-950 to-black overflow-hidden">
      <div className="relative w-full h-screen flex flex-col">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(circle_at_50%_50%,rgba(120,0,255,0.5),transparent_70%)]"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse"></div>
          <div
            className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-blue-600 rounded-full mix-blend-screen filter blur-3xl opacity-10 animate-pulse"
            style={{ animationDelay: "1s" }}
          ></div>
        </div>

        {/* Content container */}
        <div className="relative z-10 flex flex-col h-full p-2 sm:p-4">
          <div className="flex flex-col lg:flex-row flex-1 gap-2 sm:gap-4 h-full overflow-hidden">
            <div
              className={`
                w-full lg:w-96 rounded-xl sm:rounded-2xl overflow-hidden backdrop-blur-md bg-black/30 border border-white/10 flex flex-col
                ${
                  isMobile
                    ? mapExpanded
                      ? "h-[60vh]"
                      : "h-[30vh]"
                    : "flex-shrink-0" /* On desktop, height is determined by the parent flex row; it will stretch. */
                }
                transition-all duration-300 ease-in-out
              `}
            >
              <div className="p-2 sm:p-3 bg-black/50 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                <h2 className="text-sm font-medium text-purple-300 flex items-center gap-1">
                  <MemoizedMapPin className="h-3 w-3 sm:h-4 sm:w-4" /> Nearby
                  Users
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-300/70">
                    {users.length} online
                  </span>
                  {isMobile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 rounded-full"
                      onClick={toggleMap}
                    >
                      {mapExpanded ? (
                        <MemoizedChevronDown className="h-4 w-4 text-purple-300" />
                      ) : (
                        <MemoizedChevronUp className="h-4 w-4 text-purple-300" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="relative w-full flex-1">
                <MapComponent {...stableMapProps} />
              </div>
            </div>

            {/* Chat section - Larger on mobile */}
            <div className="flex flex-col flex-1 rounded-xl sm:rounded-2xl overflow-hidden backdrop-blur-md bg-black/30 border border-white/10">
              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 scrollbar-thin scrollbar-thumb-purple-900 scrollbar-track-transparent flex flex-col">
                <MessageList
                  messages={messages}
                  session={session}
                  formatTime={formatTime}
                />
                <div ref={messagesEndRef} />
              </div>

              {/* Chat input */}
              <div className="p-2 sm:p-4 bg-black/50 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full bg-white/5 hover:bg-white/10 h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <MemoizedPaperclip className="h-4 w-4 sm:h-5 sm:w-5 text-purple-300" />
                  </Button>
                  <div className="relative flex-1">
                    <Input
                      value={newMessage}
                      onChange={handleMessageChange}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="bg-white/5 border-white/10 rounded-full pl-4 pr-12 py-5 sm:py-6 focus-visible:ring-purple-500 placeholder:text-gray-400"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={isSendDisabled}
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-8 w-8 sm:h-10 sm:w-10 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MemoizedSend className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full bg-white/5 hover:bg-white/10 h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <MemoizedSmile className="h-4 w-4 sm:h-5 sm:w-5 text-purple-300" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Export the memoized version to prevent unnecessary re-renders
export default memo(ChatPage);
