import { and, asc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buchung, kurstermin, mitglied, tarif, wartelisteneintrag } from "@/lib/db/schema";
import { benachrichtige } from "@/lib/notify";
import { pruefeMonatslimit } from "@/lib/booking/limit";
import { darfLivestreamBuchen } from "@/lib/content/zugriff";

// FZ-002 — Warteliste: FIFO-Nachrücken, 30-Min-Fenster, harte Obergrenze (BR2/BR3).
// Konzept: docs/concepts/FZ-002-warteliste.md

// Harte Obergrenze aktiver Einträge pro Kurstermin. Annahme aus spec-Beispiel (§8),
// pro Termin. Zentraler Wert, damit später leicht anpassbar.
export const MAX_WARTELISTE = 5;

// Nachrück-Bestätigungsfenster.
const FRIST_MINUTEN = 30;

const AKTIV = ["wartend", "benachrichtigt"] as const;

// Transaktions-Typ aus db.transaction ableiten (nicht identisch mit `typeof db`).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type WarteErgebnis =
  | { status: "wartend"; position: number }
  | { status: "platz_frei" } //          nicht voll → regulär buchen (FZ-001)
  | { status: "bereits_gebucht" }
  | { status: "bereits_wartend"; position: number }
  | { status: "warteliste_voll" }
  | { status: "livestream_gesperrt" } // Basic darf keine Livestreams (BR7/FZ-018)
  | { status: "kurs_nicht_buchbar" };

export type NachrueckErgebnis =
  | { status: "nachgerueckt"; buchungId: string }
  | { status: "abgelaufen" }
  | { status: "kein_angebot" } //        kein aktives Nachrück-Angebot
  | { status: "limit_erreicht"; limit: number } // Monatslimit erreicht (BR4)
  | { status: "kurs_nicht_buchbar" };

async function bestaetigteBelegung(tx: Tx, kursterminId: string): Promise<number> {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(buchung)
    .where(
      and(eq(buchung.kursterminId, kursterminId), eq(buchung.buchungsstatus, "bestaetigt")),
    );
  return r.n;
}

/**
 * Tritt der Warteliste bei, wenn der Kurstermin voll ist. FIFO über `zeitstempel`,
 * einheitliche Obergrenze (kein Premium-Vordrängeln, BR3). Der Kurstermin wird
 * gesperrt, damit Belegungs-/Wartelistenprüfung atomar zur Buchung (FZ-001) sind.
 */
export async function warteAufKurstermin(
  mitgliedId: string,
  kursterminId: string,
): Promise<WarteErgebnis> {
  return db.transaction(async (tx) => {
    const [termin] = await tx
      .select({
        kapazitaet: kurstermin.kapazitaet,
        status: kurstermin.status,
        modus: kurstermin.modus,
      })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");

    if (!termin || termin.status !== "geplant") return { status: "kurs_nicht_buchbar" };

    // Livestream-Gate (BR7/FZ-018): Basic darf nicht mal auf die Livestream-Warteliste.
    if (termin.modus === "Livestream") {
      const [t] = await tx
        .select({ livestream: tarif.livestreamZugriff })
        .from(mitglied)
        .innerJoin(tarif, eq(mitglied.tarifId, tarif.tarifId))
        .where(eq(mitglied.mitgliedId, mitgliedId));
      if (!darfLivestreamBuchen(t?.livestream ?? null)) return { status: "livestream_gesperrt" };
    }

    // Nicht voll → gehört nicht auf die Warteliste, sondern gebucht.
    if ((await bestaetigteBelegung(tx, kursterminId)) < termin.kapazitaet) {
      return { status: "platz_frei" };
    }

    // Schon (aktiv) gebucht?
    const [gebucht] = await tx
      .select({ id: buchung.buchungId })
      .from(buchung)
      .where(
        and(
          eq(buchung.mitgliedId, mitgliedId),
          eq(buchung.kursterminId, kursterminId),
          eq(buchung.buchungsstatus, "bestaetigt"),
        ),
      );
    if (gebucht) return { status: "bereits_gebucht" };

    // Aktive Wartelisteneinträge dieses Termins (FIFO).
    const aktive = await tx
      .select({ mitgliedId: wartelisteneintrag.mitgliedId })
      .from(wartelisteneintrag)
      .where(
        and(
          eq(wartelisteneintrag.kursterminId, kursterminId),
          inArray(wartelisteneintrag.status, [...AKTIV]),
        ),
      )
      .orderBy(asc(wartelisteneintrag.zeitstempel));

    const vorhandenIdx = aktive.findIndex((e) => e.mitgliedId === mitgliedId);
    if (vorhandenIdx >= 0) {
      return { status: "bereits_wartend", position: vorhandenIdx + 1 };
    }

    if (aktive.length >= MAX_WARTELISTE) return { status: "warteliste_voll" };

    await tx.insert(wartelisteneintrag).values({ mitgliedId, kursterminId, status: "wartend" });
    return { status: "wartend", position: aktive.length + 1 };
  });
}

/**
 * Nachrück-Engine (BR2): lässt abgelaufene Angebote verfallen und benachrichtigt so
 * viele wartende Mitglieder (streng nach `zeitstempel`), wie Plätze frei sind.
 * Ein `benachrichtigt`-Eintrag mit laufender Frist reserviert seinen Platz.
 * Idempotent — aufrufbar nach Storno (Platz frei) und periodisch per Cron (Ablauf).
 */
export async function verarbeiteWarteliste(kursterminId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const [termin] = await tx
      .select({ kapazitaet: kurstermin.kapazitaet, status: kurstermin.status })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");
    if (!termin || termin.status !== "geplant") return 0;

    const jetzt = new Date();

    // 1. Abgelaufene Angebote verfallen lassen.
    await tx
      .update(wartelisteneintrag)
      .set({ status: "abgelaufen" })
      .where(
        and(
          eq(wartelisteneintrag.kursterminId, kursterminId),
          eq(wartelisteneintrag.status, "benachrichtigt"),
          lte(wartelisteneintrag.fristBis, jetzt),
        ),
      );

    // 2. Nachrücken, solange Plätze frei sind (bestätigt + laufende Reservierungen).
    let nachgerueckt = 0;
    for (;;) {
      const belegt = await bestaetigteBelegung(tx, kursterminId);
      const [{ reserviert }] = await tx
        .select({ reserviert: sql<number>`count(*)::int` })
        .from(wartelisteneintrag)
        .where(
          and(
            eq(wartelisteneintrag.kursterminId, kursterminId),
            eq(wartelisteneintrag.status, "benachrichtigt"),
            gt(wartelisteneintrag.fristBis, jetzt),
          ),
        );

      if (belegt + reserviert >= termin.kapazitaet) break;

      const [naechster] = await tx
        .select({ id: wartelisteneintrag.wlId, mitgliedId: wartelisteneintrag.mitgliedId })
        .from(wartelisteneintrag)
        .where(
          and(
            eq(wartelisteneintrag.kursterminId, kursterminId),
            eq(wartelisteneintrag.status, "wartend"),
          ),
        )
        .orderBy(asc(wartelisteneintrag.zeitstempel))
        .limit(1);
      if (!naechster) break;

      const fristBis = new Date(jetzt.getTime() + FRIST_MINUTEN * 60_000);
      await tx
        .update(wartelisteneintrag)
        .set({ status: "benachrichtigt", benachrichtigtAm: jetzt, fristBis })
        .where(eq(wartelisteneintrag.wlId, naechster.id));

      await benachrichtige("nachrueck_angebot", naechster.mitgliedId, { kursterminId, fristBis });
      nachgerueckt++;
    }

    return nachgerueckt;
  });
}

/**
 * Bestätigt ein aktives Nachrück-Angebot innerhalb der Frist → Buchung (BR2).
 */
export async function bestaetigeNachrueckung(
  mitgliedId: string,
  kursterminId: string,
): Promise<NachrueckErgebnis> {
  return db.transaction(async (tx) => {
    const [termin] = await tx
      .select({
        kapazitaet: kurstermin.kapazitaet,
        status: kurstermin.status,
        start: kurstermin.start,
      })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");
    if (!termin || termin.status !== "geplant") return { status: "kurs_nicht_buchbar" };

    const [eintrag] = await tx
      .select({ id: wartelisteneintrag.wlId, fristBis: wartelisteneintrag.fristBis })
      .from(wartelisteneintrag)
      .where(
        and(
          eq(wartelisteneintrag.mitgliedId, mitgliedId),
          eq(wartelisteneintrag.kursterminId, kursterminId),
          eq(wartelisteneintrag.status, "benachrichtigt"),
        ),
      );
    if (!eintrag) return { status: "kein_angebot" };

    if (!eintrag.fristBis || eintrag.fristBis <= new Date()) {
      await tx
        .update(wartelisteneintrag)
        .set({ status: "abgelaufen" })
        .where(eq(wartelisteneintrag.wlId, eintrag.id));
      return { status: "abgelaufen" };
    }

    // Buchungslimit des Tarifs (BR4) gilt auch beim Nachrücken (erzeugt eine Buchung).
    // Angebot bleibt bis Fristablauf bestehen — das Mitglied könnte Platz freimachen.
    const limit = await pruefeMonatslimit(tx, mitgliedId, termin.start);
    if (!limit.erlaubt) return { status: "limit_erreicht", limit: limit.limit };

    const [neu] = await tx
      .insert(buchung)
      .values({ mitgliedId, kursterminId, buchungsstatus: "bestaetigt" })
      .returning({ id: buchung.buchungId });

    await tx
      .update(wartelisteneintrag)
      .set({ status: "nachgerueckt" })
      .where(eq(wartelisteneintrag.wlId, eintrag.id));

    return { status: "nachgerueckt", buchungId: neu.id };
  });
}
