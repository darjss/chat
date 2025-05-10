import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  avatar: string;
  name: string;
  message: string;
  time: string;
  distance: string;
  isIncoming?: boolean;
}

export default function ChatMessage({
  avatar,
  name,
  message,
  time,
  distance,
  isIncoming = true,
}: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex gap-2 sm:gap-3 max-w-[90%] sm:max-w-[85%]",
        isIncoming ? "self-start" : "self-end flex-row-reverse"
      )}
    >
      <div className="flex-shrink-0 pt-1">
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

      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "text-xs sm:text-sm font-medium",
              isIncoming ? "text-purple-300" : "text-pink-300"
            )}
          >
            {name}
          </span>
          <div className="flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-400" />
            <span className="text-[10px] sm:text-xs text-gray-400">
              {distance}
            </span>
          </div>
        </div>

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
