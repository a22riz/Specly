import { connection } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Liveness + readiness: the process is up and SQLite is reachable.
 * `connection()` opts out of prerendering — cacheComponents forbids the
 * route-segment `dynamic` export.
 */
export async function GET() {
  try {
    await connection();
    getDb().prepare("SELECT 1").get();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
