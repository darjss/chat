import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Map from "@/components/map";
import ChatRoom from "@/components/chat-room";
import { authClient } from "@/lib/auth-client";
import { useNavigate } from "react-router";

interface Room {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  geohash: string;
  createdBy: string;
  createdAt: string;
}

export default function Chat() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [geohash, setGeohash] = useState<string>("");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState("");

  const createRoomMutation = useMutation(trpc.createChatRoom.mutationOptions());

  useEffect(() => {
    if (!session && !isPending) {
      navigate("/login");
    }
  }, [session, isPending, navigate]);

  const handleLocationSelect = (lat: number, lng: number, hash: string) => {
    setPosition([lat, lng]);
    setGeohash(hash);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !position) return;

    try {
      const roomData = await createRoomMutation.mutateAsync({
        name: roomName.trim(),
        location: {
          lat: position[0],
          lng: position[1],
        },
        geohash,
      });

      const room: Room = {
        ...roomData,
        location: JSON.parse(roomData.location),
      };

      setRoomName("");
      setSelectedRoom(room);
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (selectedRoom) {
    return <ChatRoom roomId={selectedRoom.id} roomName={selectedRoom.name} />;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-[1fr_300px] gap-4">
        <div>
          <Map onLocationSelect={handleLocationSelect} precision={6} />
        </div>

        <div className="space-y-4">
          <form onSubmit={handleCreateRoom} className="space-y-2">
            <Input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name..."
              className="w-full"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={!position || !roomName.trim()}
            >
              Create Room
            </Button>
          </form>

          <div className="text-sm text-muted-foreground">
            {position ? (
              <>
                <p>Current Location:</p>
                <p>Latitude: {position[0].toFixed(6)}</p>
                <p>Longitude: {position[1].toFixed(6)}</p>
                <p>Geohash: {geohash}</p>
              </>
            ) : (
              <p>Getting your location...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
