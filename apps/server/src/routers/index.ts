import { redis } from "@/db/redis";
import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { businessRouter } from "../trpc/router/business";

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
    const value = (await redis.get("test")) as string;
    if (!value) {
      await redis.set("test", "Hello, World!");
      return (await redis.get("test")) as string;
    }
    return value;
  }),
  business: businessRouter,
});

// Helper function to calculate distance between two points
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export type AppRouter = typeof appRouter;
