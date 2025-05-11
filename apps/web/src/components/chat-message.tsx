import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

interface ChatMessageProps {
  avatar: string;
  name: string;
  message: string;
  time: string;
  distance: string;
  isIncoming?: boolean;
  isSystem?: boolean;
}

function ChatMessage({
  avatar,
  name,
  message,
  time,
  distance,
  isIncoming = true,
  isSystem = false,
}: ChatMessageProps) {
  // For system messages, use a special layout
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/50 rounded-full border border-gray-700/50 max-w-[90%]">
          <Info className="h-3 w-3 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-300 truncate">{message}</span>
          <span className="text-[10px] text-gray-500">{time}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex max-w-[90%] sm:max-w-[85%]",
        isIncoming ? "self-start" : "self-end flex-row-reverse"
      )}
    >
      {isIncoming && (
        <div className="flex-shrink-0">
          <Avatar
            className={cn(
              "h-8 w-8 sm:h-10 sm:w-10 border-2",
              isIncoming ? "border-purple-500" : "border-pink-500"
            )}
          >
            <AvatarImage src={avatar || "/placeholder.svg"} />
            <AvatarFallback
              className={cn(
                isIncoming
                  ? "bg-purple-950 text-purple-200"
                  : "bg-pink-950 text-pink-200"
              )}
            >
              {name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      <div className={cn("flex flex-col", isIncoming ? "ml-2 sm:ml-3" : "")}>
        {isIncoming && (
          <div className="flex items-center mb-1">
            <span
              className={cn(
                "text-xs sm:text-sm font-medium",
                isIncoming ? "text-purple-300" : "text-pink-300"
              )}
            >
              {name}
            </span>
            <div className="flex items-center gap-1 ml-2">
              <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-400" />
              <span className="text-[10px] sm:text-xs text-gray-400">
                {distance}
              </span>
            </div>
          </div>
        )}

        <div
          className={cn(
            "rounded-xl sm:rounded-2xl p-2 sm:p-3 text-xs sm:text-sm",
            isIncoming
              ? "bg-purple-950/40 border border-purple-500/30 rounded-tl-none text-gray-100"
              : "bg-pink-950/40 border border-pink-500/30 rounded-tr-none text-gray-100"
          )}
        >
          {message}
        </div>

        <span className="text-[10px] sm:text-xs text-gray-400 mt-1 self-end">
          {time}
        </span>
      </div>
    </div>
  );
}

// Export the memoized version of the component to prevent unnecessary re-renders
export default React.memo(ChatMessage);
