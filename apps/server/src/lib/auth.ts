import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema/auth";
import { randomBytes, scryptSync } from "node:crypto";
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",

    schema: schema,
  }),
  advanced: {
    defaultCookieAttributes: {
      secure: true,
      httpOnly: true,
      sameSite: "none",
      partitioned: true,
    },
  },
  trustedOrigins: [process.env.CORS_ORIGIN || "", "http://localhost:5173", "https://chat-web-9h1.pages.dev"],
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => {
        // use scrypt from node:crypto
        const salt = randomBytes(16).toString("hex");
        const hash = scryptSync(password, salt, 64).toString("hex");
        return `${salt}:${hash}`;
      },
      verify: async ({ hash, password }) => {
        const [salt, key] = hash.split(":");
        const keyBuffer = Buffer.from(key, "hex");
        const hashBuffer = scryptSync(password, salt, 64);
        return keyBuffer.equals(hashBuffer);
      },
    },
  },
});
