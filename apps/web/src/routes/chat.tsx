import React, { useState, useEffect, useRef, useMemo } from "react";
import Map from "../components/map";
import ngeohash from "ngeohash";
import { authClient } from "@/lib/auth-client";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface Message {
  id: string;
  content: string;
  createdAt: string;
  userName: string;
}

interface User {
  id: number;
  name: string;
  avatar: string;
  coordinates: [number, number];
  distance?: string;
  isUser?: boolean;
}

export default function ChatPage() {
  const isMobile = useMobile();
  const [mapExpanded, setMapExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [geohash, setGeohash] = useState<string | null>(null);
  const [currentUserCoordinates, setCurrentUserCoordinates] = useState<
    [number, number] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousUsers = useRef<string[]>([]);

  const { data: session } = authClient.useSession();

  const handleLocationSelect = (lat: number, lng: number, hash: string) => {
    setGeohash(hash);
    setError(null);
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
          const hash = ngeohash.encode(
            pos.coords.latitude,
            pos.coords.longitude,
            precision
          );
          setGeohash(hash);
          setError(null);
        },
        (err) => {
          console.error("Initial geolocation error:", err);
          setError("Getting your location...");
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const coordinates: [number, number] = [
                pos.coords.longitude,
                pos.coords.latitude,
              ];
              setCurrentUserCoordinates(coordinates);
              const hash = ngeohash.encode(
                pos.coords.latitude,
                pos.coords.longitude,
                precision
              );
              setGeohash(hash);
              setError(null);
            },
            (errFallback) => {
              console.error("Fallback geolocation error:", errFallback);
              setError(
                "Unable to get your location. Please check your location settings."
              );
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
          );
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coordinates: [number, number] = [
            pos.coords.longitude,
            pos.coords.latitude,
          ];
          setCurrentUserCoordinates(coordinates);
          const hash = ngeohash.encode(
            pos.coords.latitude,
            pos.coords.longitude,
            precision
          );
          setGeohash(hash);
          setError(null);
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
      setError("Geolocation is not supported by your browser.");
    }
  }, [precision]);

  // Toggle map expansion on mobile
  const toggleMap = () => {
    setMapExpanded(!mapExpanded);
  };

  useEffect(() => {
    // Scroll to bottom whenever messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!geohash) return;

    // Close existing WebSocket connection if any
    if (ws.current) {
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
        };

        ws.current.onmessage = (event) => {
          const data = JSON.parse(event.data as string);
          if (data.type === "history") {
            setMessages(data.messages);
          } else if (data.type === "users") {
            setUsers(JSON.parse(data.users));
          } else if (
            data.content &&
            data.userName &&
            data.createdAt &&
            data.id
          ) {
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
        ws.current.close();
      }
    };
  }, [geohash]);

  const sendMessage = () => {
    if (
      newMessage.trim() &&
      ws.current &&
      ws.current.readyState === WebSocket.OPEN
    ) {
      const messageData: Message = {
        id: new Date().toISOString(), // Simple ID generation
        content: newMessage,
        createdAt: new Date().toISOString(),
        userName: session?.user?.name || "Anonymous",
      };
      ws.current.send(JSON.stringify(messageData));
      setNewMessage("");
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Remove the mockUsers array and create a computed users array based on actual data
  const mapUsers = useMemo(() => {
    if (!geohash) return [];

    const currentUser: User = {
      id: 1,
      name: session?.user?.name || "You",
      avatar: session?.user?.image || "/placeholder.svg",
      coordinates: currentUserCoordinates || ([0, 0] as [number, number]),
      isUser: true,
      distance: "nearby",
    };

    const otherUsers: User[] = users.map((userName, index) => ({
      id: index + 2,
      name: userName,
      avatar: "/placeholder.svg",
      coordinates: [0, 0] as [number, number],
      distance: "nearby",
    }));

    return [currentUser, ...otherUsers];
  }, [
    geohash,
    users,
    session?.user?.name,
    session?.user?.image,
    currentUserCoordinates,
  ]);
  console.log(mapUsers);
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
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4" /> Nearby Users
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
                        <ChevronDown className="h-4 w-4 text-purple-300" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-purple-300" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {messages.map((msg) => {
                  const isCurrentUser = msg.userName === session?.user?.name;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${
                        isCurrentUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      {isCurrentUser ? (
                        <div className="bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-600 px-4 py-2 rounded-full text-sm shadow-sm border border-indigo-200 flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-2"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                          </svg>
                          {msg.content}
                        </div>
                      ) : (
                        <div
                          className={`p-3 rounded-2xl max-w-xs lg:max-w-md break-words ${
                            isCurrentUser
                              ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-tr-none shadow-md"
                              : "bg-white text-gray-800 rounded-tl-none shadow-md border border-gray-200"
                          }`}
                        >
                          <div
                            className={`font-medium text-sm mb-1 ${
                              isCurrentUser
                                ? "text-indigo-100"
                                : "text-indigo-600"
                            }`}
                          >
                            {msg.userName}
                          </div>
                          <div className="text-sm">{msg.content}</div>
                          <div
                            className={`text-xs mt-1 ${
                              isCurrentUser
                                ? "text-indigo-200"
                                : "text-gray-500"
                            }`}
                          >
                            {formatTime(msg.createdAt)}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              <div className="relative w-full flex-1">
                <MapComponent
                  users={mapUsers}
                  centerCoordinates={currentUserCoordinates}
                  geolocationError={error}
                />
              </div>
            </div>

            {/* Chat section - Larger on mobile */}
            <div className="flex flex-col flex-1 rounded-xl sm:rounded-2xl overflow-hidden backdrop-blur-md bg-black/30 border border-white/10">
              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 scrollbar-thin scrollbar-thumb-purple-900 scrollbar-track-transparent">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    avatar="/placeholder.svg"
                    name={msg.userName}
                    message={msg.content}
                    time={formatTime(msg.createdAt)}
                    distance="nearby"
                    isIncoming={msg.userName !== session?.user?.name}
                  />
                ))}
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
                    <Paperclip className="h-4 w-4 sm:h-5 sm:w-5 text-purple-300" />
                  </Button>
                  <div className="relative flex-1">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Type a message..."
                      className="bg-white/5 border-white/10 rounded-full pl-4 pr-12 py-5 sm:py-6 focus-visible:ring-purple-500 placeholder:text-gray-400"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={
                        !ws.current ||
                        ws.current.readyState !== WebSocket.OPEN ||
                        !newMessage.trim()
                      }
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-8 w-8 sm:h-10 sm:w-10 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full bg-white/5 hover:bg-white/10 h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <Smile className="h-4 w-4 sm:h-5 sm:w-5 text-purple-300" />
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
