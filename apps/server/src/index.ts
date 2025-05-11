import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";
import { auth } from "./lib/auth";

// Extend CloudflareBindings interface with the R2 storage
declare global {
  interface CloudflareBindings {
    FILE_STORAGE: R2Bucket;
  }
}

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

// Route for uploading files to R2
app.post("/api/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    const filename = `${Date.now()}_${file.name}`;
    await c.env.FILE_STORAGE.put(filename, file);

    return c.json({
      success: true,
      filename,
      url: `/api/files/${filename}`,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return c.json({ error: "Failed to upload file" }, 500);
  }
});

// Route for retrieving files from R2
app.get("/api/files/:filename", async (c) => {
  const filename = c.req.param("filename");

  try {
    const file = await c.env.FILE_STORAGE.get(filename);

    if (!file) {
      return c.json({ error: "File not found" }, 404);
    }

    const headers = new Headers();
    file.writeHttpMetadata(headers);
    headers.set("etag", file.httpEtag);

    return new Response(file.body, {
      headers,
    });
  } catch (error) {
    console.error("File retrieval error:", error);
    return c.json({ error: "Failed to retrieve file" }, 500);
  }
});

app.get("/chat-room/:id", (c) => {
  const stub = c.env.CHAT_ROOM.get(
    c.env.CHAT_ROOM.idFromName(c.req.param("id"))
  );
  return stub.fetch(c.req.raw);
});

export { ChatRoom } from "./chat-room";
export default app;
