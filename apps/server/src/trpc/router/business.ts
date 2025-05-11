import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../../lib/trpc";
import { businessOperations } from "../../db/redis";
import type { BusinessData } from "../../db/redis";
import type { Context } from "../../lib/context";
import { TRPCError } from "@trpc/server";

// Define input types for better type safety
const NearbyBusinessesInput = z.object({
  latitude: z.number(),
  longitude: z.number(),
  radius: z.number().default(100),
});

type NearbyBusinessesInputType = z.infer<typeof NearbyBusinessesInput>;

const RegisterBusinessInput = z.object({
  name: z.string(),
  description: z.string(),
  logo: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

type RegisterBusinessInputType = z.infer<typeof RegisterBusinessInput>;

// Type for raw business data from Redis
type RawBusinessData = {
  id: string;
  name: string;
  description: string;
  logo: string;
  ownerId: string;
  coordinates: string; // As string from Redis
  [key: string]: unknown; // Allow other properties
};

export const businessRouter = router({
  getNearby: publicProcedure
    .input(NearbyBusinessesInput)
    .query(
      async ({
        input,
      }: {
        input: NearbyBusinessesInputType;
      }): Promise<BusinessData[]> => {
        const { latitude, longitude, radius } = input;

        // Get businesses near coordinates
        const businesses = await businessOperations.getNearbyBusinesses(
          longitude,
          latitude,
          radius
        );

        console.info("businesses", businesses);

        // Parse the coordinates from string back to array if needed
        return businesses
          .map((business) => {
            if (!business) return null;

            // Parse coordinates from string to array
            let coordinates: [number, number] = [0, 0];
            if (typeof business.coordinates === "string") {
              try {
                coordinates = JSON.parse(business.coordinates) as [
                  number,
                  number
                ];
              } catch (e) {
                console.error("Failed to parse coordinates", e);
              }
            } else if (Array.isArray(business.coordinates)) {
              // If coordinates are already an array, use them directly
              coordinates = business.coordinates as [number, number];
            }

            // Return as BusinessData type
            return {
              id: business.id,
              name: business.name,
              description: business.description,
              logo: business.logo,
              ownerId: business.ownerId,
              coordinates,
            } as BusinessData;
          })
          .filter((business): business is BusinessData => business !== null);
      }
    ),

  register: protectedProcedure
    .input(RegisterBusinessInput)
    .mutation(
      async ({
        input,
        ctx,
      }: {
        input: RegisterBusinessInputType;
        ctx: Context;
      }) => {
        const { name, description, logo, latitude, longitude } = input;

        // Check if session exists - should never happen with protectedProcedure
        // but TypeScript doesn't know that
        if (!ctx.session) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Authentication required",
          });
        }

        const userId = ctx.session.user.id;

        const businessId = crypto.randomUUID();

        const business: BusinessData = {
          id: businessId,
          name,
          description,
          logo,
          ownerId: userId,
          coordinates: [longitude, latitude],
        };

        // Store business in Redis
        const success = await businessOperations.addBusiness(business);

        if (!success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to register business",
          });
        }

        return { businessId, business };
      }
    ),
});
