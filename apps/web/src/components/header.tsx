import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, Users } from "lucide-react";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const { data: session } = authClient.useSession();

  return (
    <header className="flex items-center justify-between mb-2 sm:mb-4 px-3 py-2 sm:px-4 sm:py-3 bg-black/40 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/10">
      <div className="flex items-center gap-2">
        <h1 className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
          Proximity Chat
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-white/5 hover:bg-white/10"
        >
          <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-300" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-white/5 hover:bg-white/10"
        >
          <Menu className="h-4 w-4 sm:h-5 sm:w-5 text-purple-300" />
        </Button>
        <ModeToggle />
        <UserMenu />
        <div className="relative">
          <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border-2 border-purple-500">
            <AvatarImage src="/placeholder.svg?height=36&width=36" />
            <AvatarFallback className="bg-purple-950 text-purple-200">
              {session?.user?.name?.substring(0, 2).toUpperCase() || "ME"}
            </AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-black"></span>
        </div>
      </div>
    </header>
  );
}
