import { DurableObject } from "cloudflare:workers";
import { auth } from "./lib/auth";

interface User {
  id: string;
  name: string;
  avatar: string;
  coordinates: [number, number];
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: User;
}

interface Event {
  type: string;
  data: Message | User;
}

interface Session {
  user: User;
  socket: WebSocket;
}

export class ChatRoom extends DurableObject {
  private sessions: Session[] = [];
  private messages: Message[] = [];
  constructor(state: DurableObjectState, env: CloudflareBindings) {
    super(state, env);
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Not a websocket request", { status: 400 });
    }

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    const user = {
      id: session.user.id,
      name: session.user.name,
      avatar: session.user.image || "",
      coordinates: [0, 0] as [number, number],
    };

    const recentMessages = this.messages.slice(-20);
    server.send(JSON.stringify({ messages: recentMessages, type: "history" }));
    server.send(
      JSON.stringify({
        users: JSON.stringify(this.sessions.map((s) => s.user)),
        type: "users",
      })
    );

    server.addEventListener("close", () => {
      this.sessions = this.sessions.filter((s) => s.socket !== server);
      server.send(
        JSON.stringify({
          users: JSON.stringify(this.sessions.map((s) => s.user)),
          type: "users",
        })
      );
    });
    server.addEventListener("message", (event) => {
      const message = JSON.parse(event.data as string) as Event;
      if (message.type === "message") {
        this.messages.push(message.data as Message);
        this.broadcast(message.data as Message);
      } else if (message.type === "user") {
        this.sessions.push({ user: message.data as User, socket: server });
        const randomId = Math.random().toString(36).substring(2, 15);
        const messageData: Message = {
          id: new Date().toISOString() + randomId + "-" + session?.user?.name, // Simple ID generation
          content: user.name + " joined the chat",
          createdAt: new Date().toISOString(),
          user: {
            id: "system",
            name: "System",
            avatar: "",
            coordinates: [0, 0],
          },
        };
        this.broadcast(messageData);
      }
    });
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  broadcast(message: Message) {
    this.sessions.forEach((s) => {
      s.socket.send(JSON.stringify(message));
    });
  }
}
