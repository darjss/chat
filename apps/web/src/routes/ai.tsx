import { useChat } from "@ai-sdk/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useRef, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function AI() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: `${import.meta.env.VITE_SERVER_URL}/ai`,
  });

  useEffect(() => {
    if (!session && !isPending) {
      toast.error("Please sign in to access this page");
      navigate("/login");
    }
  }, [session, isPending, navigate]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="grid grid-rows-[1fr_auto] overflow-hidden w-full mx-auto p-4">
      <div className="overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            Ask me anything to get started!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`p-3 rounded-lg ${
                message.role === "user"
                  ? "bg-primary/10 ml-8"
                  : "bg-secondary/20 mr-8"
              }`}
            >
              <p className="text-sm font-semibold mb-1">
                {message.role === "user" ? "You" : "AI Assistant"}
              </p>
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full flex items-center space-x-2 pt-2 border-t"
      >
        <Input
          name="prompt"
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          className="flex-1"
          autoComplete="off"
          autoFocus
        />
        <Button type="submit" size="icon">
          <Send size={18} />
        </Button>
      </form>
    </div>
  );
}
