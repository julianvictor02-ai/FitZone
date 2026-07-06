import webpush from "web-push";
import {
  ladePushAbos,
  ladePushAbosTrainer,
  loeschePushAbo,
  type PushAbo,
} from "@/lib/push/abo";

// FZ-019 — Benachrichtigung per Web-Push (Kundenentscheidung „Push aufs Handy", spec §8).
// `benachrichtige` bleibt die stabile Aufrufstelle (BR2 Nachrücken, BR8 Ausfall/Verschub):
// Aufrufer (Warteliste/Kurstermin-Engine) ändern sich nicht. Ohne konfigurierte VAPID-Keys
// oder ohne Abos wird nur geloggt (Dev/Fallback), damit nichts crasht.

export type BenachrichtigungTyp =
  | "nachrueck_angebot"
  | "buchung_bestaetigt"
  | "kurs_abgesagt"
  | "kurs_verschoben"
  | "kurs_freigegeben" // FZ-022: an den Trainer, wenn der Admin seinen Vorschlag freigibt
  | "kurs_abgelehnt"; //  FZ-022: an den Trainer, wenn der Admin seinen Vorschlag ablehnt

const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@fitzone.example";

let konfiguriert = false;
if (PUB && PRIV) {
  try {
    webpush.setVapidDetails(SUBJECT, PUB, PRIV);
    konfiguriert = true;
  } catch {
    konfiguriert = false;
  }
}

// Anzeigetext je Vorgang. Details (kursterminId etc.) bleiben bewusst aus dem Payload —
// das Mitglied öffnet die App und sieht dort den Kontext (keine fremden Daten im Push).
const VORLAGE: Record<BenachrichtigungTyp, { title: string; body: string; url: string }> = {
  nachrueck_angebot: {
    title: "Platz frei geworden",
    body: "Ein Platz in deinem Wunschkurs ist frei — bitte innerhalb von 30 Minuten bestätigen.",
    url: "/kurse",
  },
  buchung_bestaetigt: {
    title: "Buchung bestätigt",
    body: "Deine Kursbuchung ist bestätigt.",
    url: "/mein-bereich",
  },
  kurs_abgesagt: {
    title: "Kurs abgesagt",
    body: "Ein von dir gebuchter Kurs wurde abgesagt.",
    url: "/mein-bereich",
  },
  kurs_verschoben: {
    title: "Kurs verschoben",
    body: "Ein von dir gebuchter Kurs wurde auf einen neuen Termin verschoben.",
    url: "/mein-bereich",
  },
  kurs_freigegeben: {
    title: "Kurs freigegeben",
    body: "Dein vorgeschlagener Kurs wurde freigegeben und ist jetzt für Mitglieder buchbar.",
    url: "/trainer",
  },
  kurs_abgelehnt: {
    title: "Kurs abgelehnt",
    body: "Dein vorgeschlagener Kurs wurde vom Admin abgelehnt.",
    url: "/trainer",
  },
};

// Versand an eine Menge Abos (Mitglied oder Trainer). Ohne VAPID-Keys/Abos wird nur
// geloggt (Dev/Fallback), damit nichts crasht. 404/410 → Abo aufräumen.
async function sendeAnAbos(
  typ: BenachrichtigungTyp,
  abos: PushAbo[],
  ziel: string,
  details: Record<string, unknown>,
): Promise<void> {
  if (!konfiguriert || abos.length === 0) {
    console.log(
      `[benachrichtige] ${typ} → ${ziel} ` +
        `(${konfiguriert ? `${abos.length} Abo(s), keine` : "Push nicht konfiguriert"})`,
      details,
    );
    return;
  }

  const v = VORLAGE[typ];
  const payload = JSON.stringify({ title: v.title, body: v.body, url: v.url, typ });

  await Promise.all(
    abos.map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          payload,
        );
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // 404/410 → Abo endgültig ungültig (abbestellt/abgelaufen) → aufräumen.
        if (code === 404 || code === 410) {
          await loeschePushAbo(a.aboId);
        } else {
          console.error(`[push] Versand fehlgeschlagen für ${ziel} (${code ?? "?"})`);
        }
      }
    }),
  );
}

export async function benachrichtige(
  typ: BenachrichtigungTyp,
  mitgliedId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const abos = await ladePushAbos(mitgliedId);
  await sendeAnAbos(typ, abos, `mitglied=${mitgliedId}`, details);
}

// FZ-022 — Benachrichtigung an einen Trainer (Freigabe/Ablehnung seines Vorschlags).
export async function benachrichtigeTrainer(
  typ: BenachrichtigungTyp,
  trainerId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const abos = await ladePushAbosTrainer(trainerId);
  await sendeAnAbos(typ, abos, `trainer=${trainerId}`, details);
}
