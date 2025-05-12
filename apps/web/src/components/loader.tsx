import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      <Loader2 className="animate-spin" />
    </div>
  );
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

interface ChatLoadingIndicatorProps {
  state: ConnectionState;
}

export function ChatLoadingIndicator({ state }: ChatLoadingIndicatorProps) {
  if (state === "connected") return null;

  if (state === "connecting") {
    return (
      <div className="bg-purple-900/40 py-1 px-3 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
          <p className="text-xs text-purple-200">Connecting to chat...</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="bg-red-900/40 py-1 px-3 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
          <p className="text-xs text-red-200">
            Connection error. Reconnecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-900/40 py-1 px-3 flex items-center justify-center">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
        <p className="text-xs text-yellow-200">
          Disconnected. Waiting to reconnect...
        </p>
      </div>
    </div>
  );
}

export function ChatRoomLoadingIndicator() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-purple-300/70 space-y-2">
      <div className="h-10 w-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm max-w-md">Connecting to chat...</p>
    </div>
  );
}
