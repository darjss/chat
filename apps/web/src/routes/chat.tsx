import React, { useState, useEffect, useRef } from "react";
import Map from "../components/map";
import ngeohash from "ngeohash";
import { authClient } from "@/lib/auth-client";

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

  const { data: session } = authClient.useSession()
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
  console.log(messages);
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

  return (
    <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row gap-6 h-[calc(100vh-4rem)] max-w-7xl">
      <div className="md:w-1/3 h-1/2 md:h-full flex flex-col gap-3">
        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 h-full">
          <Map onLocationSelect={handleLocationSelect} precision={precision} />
        </div>

        {error && (
          <div className="mt-1 text-red-500 bg-red-50 p-3 rounded-lg text-sm border border-red-100 shadow-sm transition-all duration-300">
            {error}
          </div>
        )}

        {geohash && (
          <div className="text-sm text-gray-600 bg-gray-50 py-2 px-3 rounded-lg border border-gray-100 shadow-sm">
            <span className="font-medium">Location:</span> {geohash}
          </div>
        )}
      </div>

      <div className="md:w-2/3 flex flex-col h-1/2 md:h-full bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-white flex justify-between items-center">
          <h2 className="text-xl font-medium text-gray-800">Chat Room</h2>
          {users.length > 0 && (
            <div className="text-sm bg-gray-50 py-1 px-3 rounded-full text-gray-600 border border-gray-100">
              {users.length} {users.length === 1 ? "user" : "users"} online
            </div>
          )}
        </div>

        {users.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 flex gap-1 flex-wrap">
            {users.map((user, index) => (
              <span
                key={index}
                className="text-xs bg-blue-50 text-blue-600 py-1 px-2 rounded-full"
              >
                {user}
              </span>
            ))}
          </div>
        )}

        <div className="flex-grow p-4 overflow-y-auto bg-gray-50">
          {messages.length === 0 && !geohash && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500 max-w-sm p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <div className="text-3xl mb-2">📍</div>
                <div className="font-medium mb-1">Select a location</div>
                <p className="text-sm">
                  Please allow location access or select a location on the map
                  to join a chat room.
                </p>
              </div>
            </div>
          )}

          {messages.length === 0 && geohash && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500 max-w-sm p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <div className="text-3xl mb-2">💬</div>
                <div className="font-medium mb-1">No messages yet</div>
                <p className="text-sm">
                  Be the first to say something in this area!
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.userName === session?.user?.name
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`p-3 rounded-2xl max-w-xs lg:max-w-md break-words shadow-sm transition-all duration-200 ${
                    msg.userName === session?.user?.name
                      ? "bg-blue-500 text-white rounded-tr-none"
                      : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                  }`}
                >
                  <div className="font-medium text-sm mb-1">{msg.userName}</div>
                  <div className="text-sm">{msg.content}</div>
                  <div
                    className={`text-xs mt-1 ${
                      msg.userName === "You" ? "text-blue-100" : "text-gray-400"
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-white">
          {geohash ? (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type your message..."
                className="flex-grow p-3 border border-gray-200 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm transition-all duration-200"
                disabled={
                  !ws.current || ws.current.readyState !== WebSocket.OPEN
                }
              />
              <button
                onClick={sendMessage}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-5 rounded-full disabled:opacity-50 transition-colors duration-200 flex items-center justify-center shadow-sm"
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
            <div className="text-center text-gray-500 py-3 border border-gray-100 rounded-lg bg-gray-50">
              Select a location on the map to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
