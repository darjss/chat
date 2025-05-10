import React, { useState, useEffect, useRef } from "react";
import Map from "../components/map";
import ngeohash from "ngeohash";
import { authClient } from "@/lib/auth-client";
import { motion } from "framer-motion";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  userName: string;
}

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [geohash, setGeohash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: session } = authClient.useSession();
  const handleLocationSelect = (lat: number, lng: number, hash: string) => {
    setGeohash(hash);
    setError(null);
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

  const precision = 6; // You can adjust geohash precision

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 sm:p-6">
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
          {/* Map Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:w-2/5 flex flex-col gap-4"
          >
            <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-purple-100 h-full">
              <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <h2 className="text-xl font-bold flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  GeoChat Map
                </h2>
              </div>
              <Map
                onLocationSelect={handleLocationSelect}
                precision={precision}
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-50 rounded-xl p-4 text-red-600 border-l-4 border-red-500 shadow-md"
              >
                <div className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </div>
              </motion.div>
            )}

            {geohash && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white p-3 rounded-xl shadow-md flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">Active Location:</span>
                <code className="ml-2 bg-white bg-opacity-20 px-2 py-1 rounded-md text-sm">
                  {geohash}
                </code>
              </motion.div>
            )}
          </motion.div>

          {/* Chat Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:w-3/5 flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden border border-purple-100"
          >
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
                GeoChat Room
              </h2>
              {users.length > 0 && (
                <div className="bg-white bg-opacity-20 py-1 px-3 rounded-full text-sm font-medium backdrop-blur-sm">
                  {users.length} {users.length === 1 ? "user" : "users"} online
                </div>
              )}
            </div>

            {users.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-100 flex gap-1 flex-wrap bg-indigo-50">
                <span className="text-xs text-indigo-600 mr-2 font-medium">
                  Active users:
                </span>
                {users.map((user, index) => (
                  <span
                    key={index}
                    className="text-xs bg-indigo-100 text-indigo-600 py-1 px-2 rounded-full flex items-center"
                  >
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
                    {user}
                  </span>
                ))}
              </div>
            )}

            <div className="flex-grow p-4 overflow-y-auto bg-gray-50 backdrop-blur-sm">
              {messages.length === 0 && !geohash && (
                <div className="flex items-center justify-center h-full">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="text-center max-w-sm p-8 bg-white rounded-xl shadow-lg border border-indigo-100"
                  >
                    <div className="text-5xl mb-4 bg-indigo-100 w-20 h-20 flex items-center justify-center rounded-full mx-auto text-indigo-600">
                      📍
                    </div>
                    <div className="font-bold text-xl mb-2 text-indigo-800">
                      Select a location
                    </div>
                    <p className="text-indigo-600">
                      Please allow location access or select a location on the
                      map to join a chat room.
                    </p>
                  </motion.div>
                </div>
              )}

              {messages.length === 0 && geohash && (
                <div className="flex items-center justify-center h-full">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="text-center max-w-sm p-8 bg-white rounded-xl shadow-lg border border-purple-100"
                  >
                    <div className="text-5xl mb-4 bg-purple-100 w-20 h-20 flex items-center justify-center rounded-full mx-auto text-purple-600">
                      💬
                    </div>
                    <div className="font-bold text-xl mb-2 text-purple-800">
                      No messages yet
                    </div>
                    <p className="text-purple-600">
                      Be the first to say something in this area!
                    </p>
                  </motion.div>
                </div>
              )}

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
                            isCurrentUser ? "text-indigo-200" : "text-gray-500"
                          }`}
                        >
                          {formatTime(msg.createdAt)}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
              {geohash ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Type your message..."
                    className="flex-grow p-3 border border-indigo-200 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm transition-all duration-200"
                    disabled={
                      !ws.current || ws.current.readyState !== WebSocket.OPEN
                    }
                  />
                  <button
                    onClick={sendMessage}
                    className={`bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium py-3 px-6 rounded-full disabled:opacity-50 transition-all duration-200 flex items-center justify-center shadow-md ${
                      !ws.current ||
                      ws.current.readyState !== WebSocket.OPEN ||
                      !newMessage.trim()
                        ? "opacity-50 cursor-not-allowed"
                        : "transform hover:scale-105"
                    }`}
                    disabled={
                      !ws.current ||
                      ws.current.readyState !== WebSocket.OPEN ||
                      !newMessage.trim()
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="bg-indigo-50 text-indigo-600 py-4 px-4 rounded-xl border border-indigo-100 shadow-inner flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Select a location on the map to start chatting
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
