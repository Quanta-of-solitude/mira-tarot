import { neon } from "@neondatabase/serverless";
import { SCHEMA } from "../lib/schema.mjs";

// Optional: the app also creates these tables by itself on first use.
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set (put it in .env.local)"); process.exit(1); }
const sql = neon(process.env.DATABASE_URL);
for (const s of SCHEMA.split(";").map((x) => x.trim()).filter(Boolean)) { await sql.query(s); console.log("ok:", s.split("\n")[0]); }
console.log("Database is ready.");
