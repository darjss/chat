import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Info, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useState, useRef } from "react";

interface ChatMessageProps {
  avatar: string;
  name: string;
  message: string;
  time: string;
  distance: string;
  isIncoming?: boolean;
  isSystem?: boolean;
  messageType?: "text" | "image" | "system" | "audio";
  duration?: number;
}

function ChatMessage({
  avatar,
  name,
  message,
  time,
  distance,
  isIncoming = true,
  isSystem = false,
  messageType = "text",
  duration,
}: ChatMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  // For system messages, use a special layout
  if (isSystem || messageType === "system") {
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
          {messageType === "image" ? (
            <a href={message} target="_blank" rel="noopener noreferrer">
              <img
                src={message}
                alt="User uploaded content"
                className="max-w-xs max-h-64 rounded-lg object-contain cursor-pointer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.outerHTML = `<a href="${message}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">View image: ${message}</a>`;
                }}
              />
            </a>
          ) : messageType === "audio" ? (
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayPause}
                className="w-8 h-8 flex items-center justify-center bg-purple-700 hover:bg-purple-600 rounded-full"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </button>
              <div className="flex-1 flex flex-col gap-1">
                <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{
                      width:
                        audioRef.current && audioRef.current.duration
                          ? `${
                              (currentTime / audioRef.current.duration) * 100
                            }%`
                          : "0%",
                    }}
                  />
                </div>
                <div className="flex justify-between w-full text-[10px] text-gray-400">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration || 0)}</span>
                </div>
              </div>
              <audio
                ref={audioRef}
                src={message}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                className="hidden"
              />
            </div>
          ) : (
            message
          )}
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
