import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add your Neon connection string to .env"
  );
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });

export default db;