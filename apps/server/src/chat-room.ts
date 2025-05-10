import { session } from "./db/schema/auth";
import { DurableObject } from "cloudflare:workers";
import { auth } from "./lib/auth";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  userName: string;
}

interface Session {
  userName: string;
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

    this.sessions.push({ userName: session.user.name, socket: server });
    const recentMessages = this.messages.slice(-20);
    server.send(JSON.stringify({ messages: recentMessages, type: "history" }));

    server.addEventListener("close", () => {
      this.sessions = this.sessions.filter((s) => s.socket !== server);
    });
    server.addEventListener("message", (event) => {
      const message = JSON.parse(event.data as string) as Message;
      this.messages.push(message);
      this.broadcast(message);
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
