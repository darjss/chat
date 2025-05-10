
import { redis } from "@/db/redis";
import {
  protectedProcedure, publicProcedure,
  router,
} from "../lib/trpc";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  redis: publicProcedure.query(async () => {
    const value = await redis.get("test") as string;
    if (!value) {
      await redis.set("test", "Hello, World!");
      return await redis.get("test") as string;
    }
    return value;
  }),
});
export type AppRouter = typeof appRouter;
