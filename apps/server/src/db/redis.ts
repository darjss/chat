import { Redis } from "@upstash/redis/cloudflare";
import { env } from "cloudflare:workers";

export const redis = new Redis({
  url: env.UPSTASH_REDIS_URL,
  token: env.UPSTASH_REDIS_TOKEN,
});

// Define a type for business data
export interface BusinessData {
  id: string;
  name: string;
  description: string;
  logo: string;
  ownerId: string;
  coordinates: [number, number];
}

export const businessOperations = {
  addBusiness: async (business: BusinessData) => {
    const { id, coordinates, ...data } = business;
    const [lng, lat] = coordinates;

    try {
      // Use raw Redis command for GEOADD
      await redis.geoadd("businesses", {
        longitude: lng,
        latitude: lat,
        member: id,
      });

      // Store business details
      await redis.hset(`business:${id}`, {
        id,
        ...data,
        coordinates: JSON.stringify(coordinates),
      });

      return true;
    } catch (error) {
      console.error("Error adding business to Redis:", error);
      return false;
    }
  },

  getNearbyBusinesses: async (
    lng: number,
    lat: number,
    radius: number = 100
  ) => {
    try {
      // Use raw Redis command for GEORADIUS
      const businessIds = (await redis.eval(
        `return redis.call('GEORADIUS', KEYS[1], ARGV[1], ARGV[2], ARGV[3], ARGV[4])`,
        ["businesses"],
        [lng.toString(), lat.toString(), radius.toString(), "m"]
      )) as string[];

      if (!businessIds || businessIds.length === 0) {
        return [];
      }

      // Fetch business details
      const businesses = await Promise.all(
        businessIds.map((id: string) => redis.hgetall(`business:${id}`))
      );

      return businesses.filter(Boolean);
    } catch (error) {
      console.error("Error fetching nearby businesses from Redis:", error);
      return [];
    }
  },
};
