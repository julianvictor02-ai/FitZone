import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { buchung, kurstermin, wartelisteneintrag } from "@/lib/db/schema";
import { benachrichtige } from "@/lib/notify";
import { findeTrainerKollision } from "./kollision";

// FZ-009 — Auto-Benachrichtigung bei Kursausfall/-verschiebung (BR8).
// Ein Statuswechsel auf `abgesagt`/`verschoben` benachrichtigt alle Betroffenen:
// aktive (bestätigte) Buchungen + aktive Warteliste (wartend/benachrichtigt).
// Der Kanal (Push/E-Mail/SMS) ist laut spec §8 offen → Stub `benachrichtige`; die
// Engine gibt die Empfänger zurück (testbar/auditierbar, NFR).

// Erlaubte Übergänge (spec §2): geplant→abgesagt, geplant→verschoben, verschoben→abgesagt.
const WL_AKTIV = ["wartend", "benachrichtigt"] as const;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type StatusErgebnis =
  | { status: "geaendert"; benachrichtigt: string[] }
  | { status: "nicht_gefunden" }
  | { status: "uebergang_unzulaessig"; von: string }
  | { status: "ungueltiger_start" }
  | { status: "kollision"; mitKursterminId: string }; // FZ-025: neuer Slot überlappt Trainer-Kurs

// Alle betroffenen Mitglieder eines Termins (bestätigte Buchung ODER aktive
// Warteliste), ohne Duplikate.
async function betroffeneMitglieder(tx: Tx, kursterminId: string): Promise<string[]> {
  const [gebucht, wartend] = await Promise.all([
    tx
      .select({ mitgliedId: buchung.mitgliedId })
      .from(buchung)
      .where(
        and(eq(buchung.kursterminId, kursterminId), eq(buchung.buchungsstatus, "bestaetigt")),
      ),
    tx
      .select({ mitgliedId: wartelisteneintrag.mitgliedId })
      .from(wartelisteneintrag)
      .where(
        and(
          eq(wartelisteneintrag.kursterminId, kursterminId),
          inArray(wartelisteneintrag.status, [...WL_AKTIV]),
        ),
      ),
  ]);
  return [...new Set([...gebucht, ...wartend].map((r) => r.mitgliedId))];
}

/**
 * Sagt einen Kurstermin ab (geplant/verschoben → abgesagt) und benachrichtigt alle
 * Betroffenen. Buchungen/Wartelisten bleiben als Nachweis erhalten; der Statuswechsel
 * nimmt den Termin aus den buchbaren Listen (Guard `status = geplant`).
 */
export async function sageKursterminAb(kursterminId: string): Promise<StatusErgebnis> {
  const { ergebnis, empfaenger } = await db.transaction(async (tx) => {
    const [termin] = await tx
      .select({ status: kurstermin.status })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");
    if (!termin) return { ergebnis: { status: "nicht_gefunden" as const }, empfaenger: [] };
    if (termin.status !== "geplant" && termin.status !== "verschoben") {
      return {
        ergebnis: { status: "uebergang_unzulaessig" as const, von: termin.status },
        empfaenger: [],
      };
    }

    const empfaenger = await betroffeneMitglieder(tx, kursterminId);
    await tx
      .update(kurstermin)
      .set({ status: "abgesagt" })
      .where(eq(kurstermin.kursterminId, kursterminId));

    return { ergebnis: { status: "geaendert" as const, benachrichtigt: empfaenger }, empfaenger };
  });

  for (const mitgliedId of empfaenger) {
    await benachrichtige("kurs_abgesagt", mitgliedId, { kursterminId });
  }
  return ergebnis;
}

/**
 * Verschiebt einen Kurstermin (geplant → verschoben) auf einen neuen Startzeitpunkt
 * und benachrichtigt alle Betroffenen. `neuerStart` muss in der Zukunft liegen.
 */
export async function verschiebeKurstermin(
  kursterminId: string,
  neuerStart: Date,
  jetzt: Date = new Date(),
): Promise<StatusErgebnis> {
  if (!(neuerStart instanceof Date) || isNaN(neuerStart.getTime()) || neuerStart <= jetzt) {
    return { status: "ungueltiger_start" };
  }

  const { ergebnis, empfaenger } = await db.transaction(async (tx) => {
    const [termin] = await tx
      .select({
        status: kurstermin.status,
        trainerId: kurstermin.trainerId,
        dauerMinuten: kurstermin.dauerMinuten,
      })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");
    if (!termin) return { ergebnis: { status: "nicht_gefunden" as const }, empfaenger: [] };
    if (termin.status !== "geplant") {
      return {
        ergebnis: { status: "uebergang_unzulaessig" as const, von: termin.status },
        empfaenger: [],
      };
    }

    // FZ-025 — der neue Slot darf nicht mit einem anderen Kurs des Trainers überlappen
    // (den Termin selbst ausgeklammert). Konsistent mit der Prüfung beim Vorschlagen (FZ-024).
    const konflikt = await findeTrainerKollision(
      termin.trainerId,
      neuerStart,
      termin.dauerMinuten,
      kursterminId,
    );
    if (konflikt) {
      return { ergebnis: { status: "kollision" as const, mitKursterminId: konflikt }, empfaenger: [] };
    }

    const empfaenger = await betroffeneMitglieder(tx, kursterminId);
    await tx
      .update(kurstermin)
      .set({ status: "verschoben", start: neuerStart })
      .where(eq(kurstermin.kursterminId, kursterminId));

    return { ergebnis: { status: "geaendert" as const, benachrichtigt: empfaenger }, empfaenger };
  });

  for (const mitgliedId of empfaenger) {
    await benachrichtige("kurs_verschoben", mitgliedId, { kursterminId, neuerStart });
  }
  return ergebnis;
}
