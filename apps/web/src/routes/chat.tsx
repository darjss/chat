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
import { useMutation, useQuery } from "@tanstack/react-query";

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
  Mic,
  Square,
  ChevronLeft,
  Store,
} from "lucide-react";
import MapComponent from "@/components/map-component";
import ChatMessage from "@/components/chat-message";
import { useMobile } from "@/hooks/use-mobile";
import { trpc } from "@/lib/trpc";
import { skipToken } from "@tanstack/react-query";
import {
  ChatLoadingIndicator,
  ChatRoomLoadingIndicator,
} from "@/components/loader";

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

    // Special case for businesses array
    if (obj1.length > 0 && obj1[0] && "ownerId" in obj1[0]) {
      // This is likely a businesses array, use direct comparison
      return JSON.stringify(obj1) === JSON.stringify(obj2);
    }

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
const MemoizedMic = memo(Mic);
const MemoizedSquare = memo(Square);

// Storage keys
const GEOHASH_STORAGE_KEY = "chat_geohash";
const CHAT_MODE_STORAGE_KEY = "chat_mode";
const ACTIVE_BUSINESS_STORAGE_KEY = "active_business";

// Interface for Business
interface Business {
  id: string;
  name: string;
  description: string;
  logo: string;
  coordinates: [number, number];
  ownerId: string;
}

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
  messageType?: "text" | "image" | "system" | "audio";
  duration?: number; // For audio messages
}

// WebSocket connection states
type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

// Define the message data type structure
type MessageData = {
  type: string;
  data: Message;
};

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
            isSystem={msg.user.id === "system" || msg.messageType === "system"}
            messageType={msg.messageType || "text"}
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
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // New state for business chat
  const [chatMode, setChatMode] = useState<"nearby" | "business">("nearby");
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  // New state for WebSocket connection status
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [pendingMessages, setPendingMessages] = useState<MessageData[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const wsUrl = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousUsers = useRef<User[]>([]);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPreviewUrlRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  // Load cached values on initial render
  useEffect(() => {
    const cachedGeohash = localStorage.getItem(GEOHASH_STORAGE_KEY);
    if (cachedGeohash) {
      setGeohash(cachedGeohash);
    }

    // Load cached chat mode and active business
    const cachedChatMode = localStorage.getItem(CHAT_MODE_STORAGE_KEY) as
      | "nearby"
      | "business"
      | null;
    if (cachedChatMode) {
      setChatMode(cachedChatMode);
    }

    const cachedBusinessJson = localStorage.getItem(
      ACTIVE_BUSINESS_STORAGE_KEY
    );
    if (cachedBusinessJson && cachedChatMode === "business") {
      try {
        const cachedBusiness = JSON.parse(cachedBusinessJson);
        setActiveBusiness(cachedBusiness);
      } catch (e) {
        console.error("Failed to parse cached business", e);
      }
    }
  }, []);

  // Save chat mode and active business to local storage when they change
  useEffect(() => {
    localStorage.setItem(CHAT_MODE_STORAGE_KEY, chatMode);

    if (activeBusiness) {
      localStorage.setItem(
        ACTIVE_BUSINESS_STORAGE_KEY,
        JSON.stringify(activeBusiness)
      );
    } else {
      localStorage.removeItem(ACTIVE_BUSINESS_STORAGE_KEY);
    }
  }, [chatMode, activeBusiness]);

  const handleLocationSelect = (lat: number, lng: number, hash: string) => {
    // Compare with current geohash before setting
    if (hash !== geohash) {
      setGeohash(hash);
      setError(null);
    }
  };

  const precision = 7;

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

  // Get nearby businesses using tRPC if in nearby mode
  const { data: nearbyBusinesses = [] } = useQuery({
    ...trpc.business.getNearby.queryOptions(
      currentUserCoordinates
        ? {
            latitude: currentUserCoordinates[1],
            longitude: currentUserCoordinates[0],
            radius: 200, // 100 meters
          }
        : skipToken
    ),
    enabled: !!currentUserCoordinates && chatMode === "nearby",
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  console.log("nearbyBusinesses in chat.tsx:", nearbyBusinesses);
  // Functions to switch between chat modes
  const switchToBusiness = useCallback((business: Business) => {
    // Switch mode and set active business first
    setChatMode("business");
    setActiveBusiness(business);
    // Reset messages for new chat
    setMessages([]);
    // Set connection state to connecting
    setConnectionState("connecting");

    // The WebSocket will be reconnected in the useEffect
  }, []);

  const switchToNearby = useCallback(() => {
    // Switch mode first
    setChatMode("nearby");
    setActiveBusiness(null);
    // Reset messages for nearby chat
    setMessages([]);
    // Set connection state to connecting
    setConnectionState("connecting");

    // The WebSocket will be reconnected in the useEffect
  }, []);

  // Modify the WebSocket connection effect to handle different chat types
  useEffect(() => {
    if (!session?.user) return;

    // Function to determine the appropriate WebSocket URL
    const getWebSocketUrl = () => {
      if (chatMode === "nearby" && geohash) {
        return `${import.meta.env.VITE_SERVER_URL.replace(
          "http",
          "ws"
        )}/chat-room/${geohash}`;
      } else if (chatMode === "business" && activeBusiness) {
        return `${import.meta.env.VITE_SERVER_URL.replace(
          "http",
          "ws"
        )}/chat-room/business-${activeBusiness.id}`;
      }
      return null;
    };

    // Get the appropriate WebSocket URL
    const newWsUrl = getWebSocketUrl();

    // If no valid URL or same URL as before, don't reconnect
    if (!newWsUrl) {
      setConnectionState("disconnected");
      return;
    }

    // If URL hasn't changed and connection is already established or connecting, don't reconnect
    if (
      newWsUrl === wsUrl.current &&
      (connectionState === "connected" || connectionState === "connecting") &&
      ws.current
    ) {
      return;
    }

    // Update the ref for the current URL
    wsUrl.current = newWsUrl;

    // Clean up any existing WebSocket before creating a new one
    if (ws.current) {
      console.log("Closing existing WebSocket connection");
      ws.current.onclose = null; // Remove existing onclose handler to prevent duplicate handlers
      ws.current.close();
      ws.current = null;
    }

    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Set connecting state
    setConnectionState("connecting");

    const connectWebSocket = () => {
      if (!wsUrl.current) return;

      try {
        console.log(`Connecting to WebSocket at ${wsUrl.current}`);
        ws.current = new WebSocket(wsUrl.current);

        ws.current.onopen = () => {
          console.log("WebSocket connected");
          setConnectionState("connected");
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

            // Send any pending messages
            if (pendingMessages.length > 0) {
              console.log(`Sending ${pendingMessages.length} pending messages`);
              pendingMessages.forEach((msg) => {
                ws.current?.send(JSON.stringify(msg));
              });
              setPendingMessages([]);
            }
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
          setConnectionState("error");
          setError("WebSocket connection error. Attempting to reconnect...");

          // Schedule a reconnection attempt
          if (!reconnectTimeoutRef.current) {
            reconnectTimeoutRef.current = window.setTimeout(() => {
              reconnectTimeoutRef.current = null;
              connectWebSocket();
            }, 3000);
          }
        };

        ws.current.onclose = (event) => {
          console.log(
            `WebSocket disconnected with code: ${event.code}, reason: ${event.reason}`
          );
          setConnectionState("disconnected");

          // Only attempt to reconnect if this wasn't a clean close by the app
          if (!event.wasClean) {
            setError("Connection lost. Attempting to reconnect...");

            // Schedule a reconnection attempt
            if (!reconnectTimeoutRef.current) {
              reconnectTimeoutRef.current = window.setTimeout(() => {
                reconnectTimeoutRef.current = null;
                connectWebSocket();
              }, 3000);
            }
          }
        };
      } catch (e) {
        console.error("Failed to connect to WebSocket:", e);
        setConnectionState("error");
        setError(
          "Failed to establish chat connection. Retrying in a few seconds..."
        );

        // Schedule a reconnection attempt
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectWebSocket();
          }, 3000);
        }
      }
    };

    connectWebSocket();

    return () => {
      // Clean up WebSocket connection
      if (ws.current) {
        console.log("Cleaning up WebSocket connection");
        ws.current.onclose = null; // Remove the handler to prevent reconnection attempts
        ws.current.close();
        ws.current = null;
      }

      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [geohash, session, chatMode, activeBusiness]);

  // Memoize the sendMessage function with improved handling for connection state
  const sendMessage = useCallback(() => {
    if (!newMessage.trim() || !session?.user) return;

    const randomId = Math.random().toString(36).substring(2, 15);
    const messageData: MessageData = {
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
        messageType: "text",
      },
    };

    // Check WebSocket connection state
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      // If connected, send directly
      ws.current.send(JSON.stringify(messageData));
    } else {
      // If not connected, add to pending messages and show as optimistic UI update
      console.log("WebSocket not connected, adding message to pending queue");
      setPendingMessages((prev) => [...prev, messageData]);

      // Add message to local state for immediate display (optimistic update)
      setMessages((prev) => [...prev, messageData.data]);

      // If connection state is error or disconnected, attempt to reconnect
      if (connectionState === "error" || connectionState === "disconnected") {
        // The reconnection logic is handled in the WebSocket useEffect
        setConnectionState("connecting");
      }
    }

    setNewMessage("");
  }, [newMessage, ws, session, currentUserCoordinates, connectionState]);

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
    businesses?: Business[];
    centerCoordinates: [number, number] | null;
    geolocationError: string | null;
    onBusinessClick?: (business: Business) => void;
  };

  // Further stabilize the props for MapComponent - compute the props first
  const mapPropsValue = useMemo<MapComponentProps>(() => {
    const props = {
      users: mapUsers,
      businesses: nearbyBusinesses as Business[], // Explicitly cast to Business[]
      centerCoordinates: currentUserCoordinates,
      geolocationError: error,
      onBusinessClick: switchToBusiness,
    };
    console.log("mapPropsValue businesses:", props.businesses);
    return props;
  }, [
    mapUsers,
    nearbyBusinesses,
    currentUserCoordinates,
    error,
    switchToBusiness,
  ]);

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

  // Mutation function for file upload
  const uploadFileMutationFn = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const uploadUrl = `${import.meta.env.VITE_SERVER_URL}/api/upload`;
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
      // headers: { 'Authorization': `Bearer ${session?.accessToken}` }, // If auth needed
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: response.statusText };
      }
      throw new Error(
        errorData.error || `Upload failed with status: ${response.status}`
      );
    }
    return response.json(); // Returns { success: boolean, filename: string, url: string }
  };

  // Start recording function
  const startRecording = useCallback(async () => {
    try {
      // Reset previous recording data
      audioChunksRef.current = [];
      setRecordingDuration(0);
      setAudioBlob(null);

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Add event listeners
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Combine all chunks into a single blob
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setAudioBlob(audioBlob);

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());

        // Clear the recording timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        // Auto upload the recording
        if (audioBlob.size > 0) {
          // Create a File from the Blob
          const audioFile = new File(
            [audioBlob],
            `voice-message-${Date.now()}.webm`,
            {
              type: "audio/webm",
            }
          );

          // Upload the audio file
          uploadMutation.mutate(audioFile);
        }
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);

      // Setup timer to track recording duration
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      setFileError(
        "Could not access microphone. Please check your permissions."
      );
      setIsRecording(false);
    }
  }, []);

  // Stop recording function
  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // Clean up recording on component unmount
  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const uploadMutation = useMutation({
    mutationFn: uploadFileMutationFn,
    onSuccess: (data) => {
      if (data.success && data.url) {
        if (
          ws.current &&
          ws.current.readyState === WebSocket.OPEN &&
          session?.user
        ) {
          const randomId = Math.random().toString(36).substring(2, 15);
          const fileUrl = `${import.meta.env.VITE_SERVER_URL}${data.url}`;
          const isAudio = audioBlob !== null;

          const messageData = {
            type: "message",
            data: {
              id:
                new Date().toISOString() +
                randomId +
                "-" +
                session?.user?.name +
                (isAudio ? "-audio" : "-image"),
              content: fileUrl,
              createdAt: new Date().toISOString(),
              user: {
                id: session.user.id || randomId,
                name: session.user.name || "Anonymous",
                avatar: session.user.image || "/placeholder.svg",
                coordinates: currentUserCoordinates || [0, 0],
              },
              messageType: isAudio ? ("audio" as const) : ("image" as const),
              duration: isAudio ? recordingDuration : undefined,
            },
          };
          ws.current.send(JSON.stringify(messageData));
          setFileError(null);

          // Reset audio recording state
          if (isAudio) {
            setAudioBlob(null);
            setRecordingDuration(0);
          }

          if (uploadPreviewUrlRef.current) {
            URL.revokeObjectURL(uploadPreviewUrlRef.current);
            setUploadPreviewUrl(null);
            uploadPreviewUrlRef.current = null;
          }
        } else {
          // This case should ideally be handled by disabling UI or better error
          setFileError(
            "Cannot send message: WebSocket not ready or user not logged in."
          );
        }
      } else {
        setFileError(data.error || "Upload succeeded but no URL was returned.");
      }
    },
    onError: (error: Error) => {
      setFileError(error.message || "File upload failed.");
      // Preview URL is not cleared here on error, user might want to retry with same preview
      // It will be cleared if they select a new file.
    },
    onSettled: () => {
      // This runs after onSuccess or onError
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear the file input
      }
    },
  });

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelectAndUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (uploadPreviewUrlRef.current) {
        URL.revokeObjectURL(uploadPreviewUrlRef.current);
      }
      setUploadPreviewUrl(null);
      uploadPreviewUrlRef.current = null;
      setFileError(null);

      if (!file.type.startsWith("image/")) {
        setFileError("Please select an image file (e.g., PNG, JPG, GIF).");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const MAX_FILE_SIZE = 4 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        setFileError(
          `File is too large. Max size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const currentPreviewObjectUrl = URL.createObjectURL(file);
      setUploadPreviewUrl(currentPreviewObjectUrl);
      uploadPreviewUrlRef.current = currentPreviewObjectUrl;

      uploadMutation.mutate(file); // Use react-query to handle the upload
    },
    [uploadMutation] // Depends on the mutate function from useMutation
  );

  // useEffect for unmount cleanup
  useEffect(() => {
    return () => {
      if (uploadPreviewUrlRef.current) {
        URL.revokeObjectURL(uploadPreviewUrlRef.current);
        uploadPreviewUrlRef.current = null;
      }
    };
  }, []); // Empty dependency array, runs only on mount and unmount

  // Format recording time
  const formatRecordingTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  }, []);

  // Optimize send button disabled state with useMemo
  const isSendDisabled = useMemo(() => {
    return (
      !newMessage.trim() ||
      (connectionState !== "connected" && pendingMessages.length > 5) || // Limit pending messages to 5
      uploadMutation.isPending ||
      isRecording
    );
  }, [
    connectionState,
    newMessage,
    pendingMessages.length,
    uploadMutation.isPending,
    isRecording,
  ]);

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
                  <MemoizedMapPin className="h-3 w-3 sm:h-4 sm:w-4" />
                  {chatMode === "nearby" ? "Nearby Users" : "Business Chat"}
                </h2>
                <div className="flex items-center gap-2">
                  {chatMode === "nearby" ? (
                    <span className="text-xs text-purple-300/70">
                      {users.length} online
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 rounded-full text-purple-300 hover:text-purple-100 hover:bg-purple-900/50"
                      onClick={switchToNearby}
                    >
                      <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="text-xs">Back</span>
                    </Button>
                  )}
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
              {/* Business Chat Header */}
              {chatMode === "business" && activeBusiness && (
                <div className="p-2 sm:p-3 bg-black/50 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={switchToNearby}
                      className="rounded-full h-7 w-7 p-0"
                    >
                      <ChevronLeft className="h-4 w-4 text-purple-300" />
                    </Button>
                    <Store className="h-4 w-4 text-purple-300" />
                    <div className="flex flex-col">
                      <h2 className="text-sm font-medium text-purple-300">
                        {activeBusiness.name}
                      </h2>
                      <p className="text-xs text-purple-300/70 truncate max-w-[200px]">
                        {activeBusiness.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Connection status indicator */}
              <ChatLoadingIndicator state={connectionState} />

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 scrollbar-thin scrollbar-thumb-purple-900 scrollbar-track-transparent flex flex-col">
                {chatMode === "business" &&
                  activeBusiness &&
                  messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-purple-300/70 space-y-2">
                      <Store className="h-12 w-12 text-purple-300/50" />
                      <h3 className="text-lg font-medium">
                        Welcome to {activeBusiness.name}
                      </h3>
                      <p className="text-sm max-w-md">
                        This is the beginning of the chat with{" "}
                        {activeBusiness.name}. Say hello!
                      </p>
                    </div>
                  )}
                {messages.length === 0 &&
                  connectionState === "connecting" &&
                  chatMode === "nearby" && <ChatRoomLoadingIndicator />}
                <MessageList
                  messages={messages}
                  session={session}
                  formatTime={formatTime}
                />
                <div ref={messagesEndRef} />
              </div>

              {/* Chat input */}
              <div className="p-2 sm:p-4 bg-black/50 border-t border-white/5">
                {fileError && (
                  <p className="text-red-400 text-xs mb-2 text-center px-2">
                    {fileError}
                  </p>
                )}
                {isRecording && (
                  <div className="flex items-center gap-2 p-2 bg-black/20 rounded-md mb-2 mx-1 sm:mx-0">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-purple-300 text-sm">
                      Recording... {formatRecordingTime(recordingDuration)}
                    </p>
                  </div>
                )}
                {uploadMutation.isPending && !isRecording && (
                  <div className="flex items-center gap-2 p-2 bg-black/20 rounded-md mb-2 mx-1 sm:mx-0">
                    {uploadPreviewUrl ? (
                      <img
                        src={uploadPreviewUrl}
                        alt="Preview"
                        className="h-10 w-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center bg-purple-900/50 rounded">
                        <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <p className="text-purple-300 text-sm animate-pulse">
                      Uploading{" "}
                      {audioBlob
                        ? "audio"
                        : uploadPreviewUrl
                        ? "image"
                        : "file"}
                      ...
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelectAndUpload}
                    accept="image/*" // Accepts all image types
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full bg-white/5 hover:bg-white/10 h-8 w-8 sm:h-10 sm:w-10"
                    onClick={triggerFileInput}
                    disabled={uploadMutation.isPending || isRecording}
                  >
                    <MemoizedPaperclip className="h-4 w-4 sm:h-5 sm:w-5 text-purple-300" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-full h-8 w-8 sm:h-10 sm:w-10 ${
                      isRecording
                        ? "bg-red-500/70 hover:bg-red-500"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={uploadMutation.isPending}
                  >
                    {isRecording ? (
                      <MemoizedSquare className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    ) : (
                      <MemoizedMic className="h-4 w-4 sm:h-5 sm:w-5 text-purple-300" />
                    )}
                  </Button>
                  <div className="relative flex-1">
                    <Input
                      value={newMessage}
                      onChange={handleMessageChange}
                      onKeyPress={handleKeyPress}
                      placeholder={
                        isRecording
                          ? "Recording voice message..."
                          : uploadMutation.isPending
                          ? "Uploading..."
                          : connectionState === "connecting"
                          ? "Connecting to chat..."
                          : "Type a message..."
                      }
                      className="bg-white/5 border-white/10 rounded-full pl-4 pr-12 py-5 sm:py-6 focus-visible:ring-purple-500 placeholder:text-gray-400 disabled:opacity-70"
                      disabled={uploadMutation.isPending || isRecording}
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
                    disabled={isRecording}
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
