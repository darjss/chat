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
  messageType?: "text" | "image" | "system" | "audio";
  duration?: number; // For audio messages
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
      const leavingUser = this.sessions.find((s) => s.socket === server)?.user;

      this.sessions = this.sessions.filter((s) => s.socket !== server);

      this.broadcastUsers();

      if (leavingUser) {
        const randomId = Math.random().toString(36).substring(2, 15);
        const leaveMessage: Message = {
          id: new Date().toISOString() + randomId,
          content: `${leavingUser.name} left the chat`,
          createdAt: new Date().toISOString(),
          user: {
            id: "system",
            name: "System",
            avatar: "",
            coordinates: [0, 0],
          },
          messageType: "system",
        };

        this.messages.push(leaveMessage);

        this.broadcast(leaveMessage);
      }
    });

    server.addEventListener("message", (event) => {
      const messageEvent = JSON.parse(event.data as string) as Event;
      if (messageEvent.type === "message") {
        const newMessage = messageEvent.data as Message;
        if (!newMessage.messageType) {
          newMessage.messageType = "text";
        }
        this.messages.push(newMessage);
        this.broadcast(newMessage);
      } else if (messageEvent.type === "user") {
        const userData = messageEvent.data as User;
        const existingUserIndex = this.sessions.findIndex(
          (s) => s.user.id === userData.id
        );

        if (existingUserIndex >= 0) {
          this.sessions[existingUserIndex].user = userData;
          this.broadcastUsers();
        } else {
          this.sessions.push({ user: userData, socket: server });

          const randomId = Math.random().toString(36).substring(2, 15);
          const joinMessage: Message = {
            id: new Date().toISOString() + randomId,
            content: `${userData.name} joined the chat`,
            createdAt: new Date().toISOString(),
            user: {
              id: "system",
              name: "System",
              avatar: "",
              coordinates: [0, 0],
            },
            messageType: "system",
          };

          this.messages.push(joinMessage);

          this.broadcast(joinMessage);
          this.broadcastUsers();
        }
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

  broadcastUsers() {
    const usersData = JSON.stringify({
      users: JSON.stringify(this.sessions.map((s) => s.user)),
      type: "users",
    });

    this.sessions.forEach((s) => {
      s.socket.send(usersData);
    });
  }
}
