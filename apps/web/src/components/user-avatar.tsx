import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  position: {
    top: string;
    left: string;
  };
  image: string;
  name: string;
  distance?: string;
  isUser?: boolean;
}

export default function UserAvatar({
  position,
  image,
  name,
  distance,
  isUser = false,
}: UserAvatarProps) {
  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="relative flex flex-col items-center">
        {/* Pulsing circle for user's own avatar */}
        {isUser && (
          <div className="absolute -inset-2 rounded-full border-2 border-purple-500/50 animate-ping"></div>
        )}

        <Avatar
          className={cn(
            "h-10 w-10 border-2 shadow-lg transition-transform duration-300 group-hover:scale-110",
            isUser ? "border-purple-500" : "border-white/30"
          )}
        >
          <AvatarImage src={image || "/placeholder.svg"} />
          <AvatarFallback
            className={cn(
              isUser
                ? "bg-purple-950 text-purple-200"
                : "bg-gray-800 text-gray-200"
            )}
          >
            {name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Connection lines */}
        {!isUser && (
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/2 left-1/2 h-px bg-gradient-to-r from-purple-500/70 to-transparent w-20 transform -translate-y-1/2 -translate-x-full"></div>
          </div>
        )}

        {/* Name tag */}
        <div className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
          <div
            className={cn(
              "px-2 py-1 rounded-full text-xs font-medium shadow-lg",
              isUser
                ? "bg-purple-500 text-white"
                : "bg-black/70 backdrop-blur-sm text-white border border-white/20"
            )}
          >
            {name}{" "}
            {distance && <span className="text-gray-300">({distance})</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
