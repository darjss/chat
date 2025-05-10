import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
//@ts-ignore
import { env } from "cloudflare:workers";
const client = createClient({
  url: env.DATABASE_URL,
  authToken: env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle({ client });
