import { useEffect, useState } from "react";
import { trpc } from "@/utils/trpc";
import Map from "./map";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Send } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";

interface ChatRoomProps {
  roomId: string;
  roomName: string;
}

interface Message {
  id: string;
  content: string;
  userId: string;
  userName: string;
  timestamp: string;
}

export default function ChatRoom({ roomId, roomName }: ChatRoomProps) {
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState<[number, number]>([51.505, -0.09]);
  const [geohash, setGeohash] = useState<string>("");

  const { data: messages, refetch: refetchMessages } = useQuery(
    trpc.getMessages.queryOptions({ roomId })
  );

  const sendMessageMutation = useMutation(trpc.sendMessage.mutationOptions());

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    sendMessageMutation.mutate(
      {
        roomId,
        content: message.trim(),
      },
      {
        onSuccess: () => {
          setMessage("");
          refetchMessages();
        },
      }
    );
  };

  const handleLocationSelect = (lat: number, lng: number, hash: string) => {
    setPosition([lat, lng]);
    setGeohash(hash);
  };

  return (
    <div className="grid grid-rows-[auto_1fr] h-full gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{roomName}</h2>
        <div className="text-sm text-muted-foreground">
          Location: {position[0].toFixed(4)}, {position[1].toFixed(4)}
          <br />
          Geohash: {geohash}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-4 h-full">
        <div className="h-full">
          <Map
            initialPosition={position}
            onLocationSelect={handleLocationSelect}
            precision={6}
          />
        </div>

        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {messages?.map((msg: Message) => (
              <div key={msg.id} className="p-2 rounded-lg bg-secondary/20">
                <div className="text-sm font-semibold">{msg.userName}</div>
                <div className="text-sm">{msg.content}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button type="submit" size="icon">
              <Send size={18} />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
