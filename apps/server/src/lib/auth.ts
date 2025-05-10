
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema/auth";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    
    provider: "sqlite",
    
    schema: schema,
  }),
  "advanced":{
    defaultCookieAttributes: {
      secure: true,
      httpOnly: true,
      sameSite: "none",  
      partitioned: true, 
  },
  },
  trustedOrigins: [
    process.env.CORS_ORIGIN || "",
  ],
  emailAndPassword: {
    enabled: true,
  }});


