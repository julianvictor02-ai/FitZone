import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { kurstermin, wartelisteneintrag } from "@/lib/db/schema";
import { verarbeiteWarteliste } from "@/lib/booking/warteliste";

// Cron-Endpoint für das automatische 30-Min-Ablaufen + Nachrücken (BR2).
// Per Bearer-Secret geschützt; via Vercel Cron oder Supabase pg_cron periodisch
// aufrufen. Verarbeitet alle künftigen Termine mit aktiver Warteliste.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const termine = await db
    .selectDistinct({ id: wartelisteneintrag.kursterminId })
    .from(wartelisteneintrag)
    .innerJoin(kurstermin, eq(wartelisteneintrag.kursterminId, kurstermin.kursterminId))
    .where(
      and(
        inArray(wartelisteneintrag.status, ["wartend", "benachrichtigt"]),
        eq(kurstermin.status, "geplant"),
        gt(kurstermin.start, new Date()),
      ),
    );

  let nachgerueckt = 0;
  for (const t of termine) nachgerueckt += await verarbeiteWarteliste(t.id);

  return NextResponse.json({ verarbeitet: termine.length, nachgerueckt });
}
