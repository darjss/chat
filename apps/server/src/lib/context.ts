import type { Context as HonoContext } from "hono";
import { auth } from "./auth";
import { redis } from "../db/redis";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    session,
    redis,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
