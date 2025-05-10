import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";
import { auth } from "./lib/auth";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: ["http://localhost:5173", "https://chat-web-9h1.pages.dev"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  })
);

app.get("/", (c) => c.text("Hello World"));

app.get("/chat-room/:id", (c) => {
  const stub = c.env.CHAT_ROOM.get(
    c.env.CHAT_ROOM.idFromName(c.req.param("id"))
  );
  return stub.fetch(c.req.raw);
});

export { ChatRoom } from "./chat-room";
export default app;
