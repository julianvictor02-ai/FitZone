import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Datenmodell FitZone — Quelle: docs/architecture.md / docs/spec.md §10.
// Business Rules BR1–BR9 (Kapazität, Warteliste, Limits, Fristen) werden in der
// Anwendungs-/DB-Logik erzwungen, nicht allein durch dieses Schema.

// --- Enums ---
export const tarifName = pgEnum("tarif_name", ["Basic", "Plus", "Premium"]);
// „geloescht" = Soft-Delete (FZ-006): Mitglied verschwindet aus der aktiven Liste und kann
// sich nicht mehr anmelden, der Datensatz bleibt aber für die Referenzintegrität bestehender
// Buchungen/Anwesenheits-/Storno-Historie erhalten (Nachweis-Zeitstempel nicht verhandelbar).
export const mitgliedStatus = pgEnum("mitglied_status", ["aktiv", "pausiert", "geloescht"]);
export const kurstypName = pgEnum("kurstyp_name", [
  "Yoga",
  "Pilates",
  "Spinning",
  "HIIT",
  "Bodyworkout",
]);
export const modus = pgEnum("modus", ["Studio", "Livestream"]);
export const kursterminStatus = pgEnum("kurstermin_status", [
  "geplant",
  "abgesagt",
  "verschoben",
  "vorgeschlagen", // FZ-020: Trainer-Vorschlag, wartet auf Admin-Freigabe (dann → geplant)
]);
export const buchungsstatus = pgEnum("buchungsstatus", ["bestaetigt", "storniert"]);
export const anwesenheit = pgEnum("anwesenheit", [
  "offen",
  "anwesend",
  "no_show",
  "entschuldigt",
]);
// Admin-Entscheidung über eine fällige Stornogebühr (FZ-016+). null = noch offen
// (Admin muss entscheiden); Abwicklung/Abbuchung bleibt manuell außerhalb (kein Payment v1).
export const stornoGebuehrEntscheidung = pgEnum("storno_gebuehr_entscheidung", [
  "erlassen",
  "bestaetigt",
]);
export const wartelisteStatus = pgEnum("warteliste_status", [
  "wartend",
  "benachrichtigt",
  "nachgerueckt",
  "abgelaufen",
]);
export const rolle = pgEnum("rolle", ["admin", "trainer", "mitglied"]);

// --- Kern-Tabellen ---
export const tarif = pgTable("tarif", {
  tarifId: uuid("tarif_id").primaryKey().defaultRandom(),
  name: tarifName("name").notNull().unique(),
  monatspreis: numeric("monatspreis", { precision: 10, scale: 2 }),
  buchungslimitProMonat: integer("buchungslimit_pro_monat"), // null = unbegrenzt (Plus/Premium)
  onDemandZugriff: boolean("on_demand_zugriff").notNull().default(false),
  livestreamZugriff: boolean("livestream_zugriff"), // Basic unklar (spec §8)
  stornoGebuehrBefreit: boolean("storno_gebuehr_befreit").notNull().default(false),
  earlyAccess: boolean("early_access").notNull().default(false),
});

export const mitglied = pgTable("mitglied", {
  mitgliedId: uuid("mitglied_id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tarifId: uuid("tarif_id")
    .notNull()
    .references(() => tarif.tarifId),
  status: mitgliedStatus("status").notNull().default("aktiv"),
  mitgliedschaftBis: date("mitgliedschaft_bis"),
  email: text("email").notNull().unique(),
});

export const trainer = pgTable("trainer", {
  trainerId: uuid("trainer_id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
});

export const kurstyp = pgTable("kurstyp", {
  kurstypId: uuid("kurstyp_id").primaryKey().defaultRandom(),
  name: kurstypName("name").notNull().unique(),
  standardKapazitaetStudio: integer("standard_kapazitaet_studio"),
  standardKapazitaetLivestream: integer("standard_kapazitaet_livestream"),
  standardDauerMinuten: integer("standard_dauer_minuten"), // FZ-023: Vorbelegung Kursdauer
  // Einzelkurs-Preis je Kursart — Basis der Stornogebühr (FZ-016, 50 %). null = noch
  // nicht gepflegt → nur Gebühren-Flag, kein Betrag (spec §8 Frage 7/11).
  einzelpreis: numeric("einzelpreis", { precision: 10, scale: 2 }),
});

export const kurstermin = pgTable("kurstermin", {
  kursterminId: uuid("kurstermin_id").primaryKey().defaultRandom(),
  kurstypId: uuid("kurstyp_id")
    .notNull()
    .references(() => kurstyp.kurstypId),
  trainerId: uuid("trainer_id")
    .notNull()
    .references(() => trainer.trainerId),
  modus: modus("modus").notNull(),
  start: timestamp("start", { withTimezone: true }).notNull(),
  dauerMinuten: integer("dauer_minuten"), // FZ-023: Kursdauer (für Ende/Kollisionsprüfung)
  kapazitaet: integer("kapazitaet").notNull(),
  status: kursterminStatus("status").notNull().default("geplant"),
  streamLink: text("stream_link"), // nur bei Livestream
});

export const onDemandVideo = pgTable("on_demand_video", {
  videoId: uuid("video_id").primaryKey().defaultRandom(),
  titel: text("titel").notNull(),
  kurstypId: uuid("kurstyp_id").references(() => kurstyp.kurstypId),
  level: text("level"),
  dauerMinuten: integer("dauer_minuten"),
  mindestTarif: tarifName("mindest_tarif").notNull(), // ordinale Zugriffsschwelle (BR7)
  plattform: text("plattform"),
  url: text("url"),
  // Soft-Delete (FZ-027, analog Mitglied FZ-006): ausgeblendet in Admin-Liste und
  // Mitglieder-Videos, der Datensatz bleibt physisch erhalten.
  geloescht: boolean("geloescht").notNull().default(false),
});

// --- Junction-Tabellen (n:m) ---
export const buchung = pgTable(
  "buchung",
  {
    buchungId: uuid("buchung_id").primaryKey().defaultRandom(),
    mitgliedId: uuid("mitglied_id")
      .notNull()
      .references(() => mitglied.mitgliedId),
    kursterminId: uuid("kurstermin_id")
      .notNull()
      .references(() => kurstermin.kursterminId),
    buchungsstatus: buchungsstatus("buchungsstatus").notNull().default("bestaetigt"),
    // Nachweis-Zeitstempel, "nicht verhandelbar" (NFR) — App darf ihn nicht ändern.
    buchungszeitpunkt: timestamp("buchungszeitpunkt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    stornozeitpunkt: timestamp("stornozeitpunkt", { withTimezone: true }),
    anwesenheit: anwesenheit("anwesenheit").notNull().default("offen"),
    // Zeitstempel der Anwesenheitserfassung (FZ-004, "mit Zeitstempel"): wann der
    // Trainer zuletzt abgehakt hat. null solange offen/nicht erfasst. Auditierbar (NFR).
    anwesenheitErfasstAm: timestamp("anwesenheit_erfasst_am", { withTimezone: true }),
    stornoGebuehrFaellig: boolean("storno_gebuehr_faellig").notNull().default(false),
    stornoGebuehrBetrag: numeric("storno_gebuehr_betrag", { precision: 10, scale: 2 }),
    // Admin-Entscheidung zur fälligen Gebühr: null = offen, sonst erlassen/bestaetigt.
    stornoGebuehrEntscheidung: stornoGebuehrEntscheidung("storno_gebuehr_entscheidung"),
    trainerNotiz: text("trainer_notiz"),
  },
  // Partieller Unique-Index: max. EINE aktive (bestaetigt) Buchung pro Mitglied+Termin.
  // Stornierte Buchungen bleiben als Historie erhalten und erlauben Neubuchung (BR1).
  (t) => [
    uniqueIndex("uq_buchung_aktiv_mitglied_termin")
      .on(t.mitgliedId, t.kursterminId)
      .where(sql`${t.buchungsstatus} = 'bestaetigt'`),
  ],
);

export const wartelisteneintrag = pgTable(
  "wartelisteneintrag",
  {
    wlId: uuid("wl_id").primaryKey().defaultRandom(),
    mitgliedId: uuid("mitglied_id")
      .notNull()
      .references(() => mitglied.mitgliedId),
    kursterminId: uuid("kurstermin_id")
      .notNull()
      .references(() => kurstermin.kursterminId),
    // FIFO-Reihenfolge strikt über zeitstempel (BR2/BR3).
    zeitstempel: timestamp("zeitstempel", { withTimezone: true })
      .notNull()
      .defaultNow(),
    position: integer("position"),
    status: wartelisteStatus("status").notNull().default("wartend"),
    benachrichtigtAm: timestamp("benachrichtigt_am", { withTimezone: true }),
    fristBis: timestamp("frist_bis", { withTimezone: true }), // benachrichtigt_am + 30 Min
  },
  // Partieller Unique-Index: max. EIN aktiver Wartelisteneintrag pro Mitglied+Termin.
  // Terminale Einträge (nachgerueckt/abgelaufen) bleiben als Historie, Wieder-
  // Anstellen bleibt möglich (analog buchung, BR2).
  (t) => [
    uniqueIndex("uq_warteliste_aktiv_mitglied_termin")
      .on(t.mitgliedId, t.kursterminId)
      .where(sql`${t.status} in ('wartend', 'benachrichtigt')`),
  ],
);

// FZ-019 — Web-Push-Abo eines Mitglieds (Browser/Gerät). endpoint ist die eindeutige
// Push-Service-URL; p256dh/auth sind die Verschlüsselungs-Keys aus der PushSubscription.
// Ein Mitglied kann mehrere Geräte/Browser haben (mehrere Zeilen).
export const pushAbo = pgTable("push_abo", {
  aboId: uuid("abo_id").primaryKey().defaultRandom(),
  // Genau eins von mitgliedId/trainerId ist gesetzt (FZ-022: Push auch für Trainer).
  mitgliedId: uuid("mitglied_id").references(() => mitglied.mitgliedId),
  trainerId: uuid("trainer_id").references(() => trainer.trainerId),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
});

// Identität/Rolle: verknüpft ein Supabase-Auth-Konto mit einer Rolle und optional
// mit einem Mitglied- oder Trainer-Datensatz. Admin hat weder mitglied_id noch
// trainer_id. benutzer_id = auth.users.id (wird beim Anlegen explizit gesetzt).
export const benutzer = pgTable("benutzer", {
  benutzerId: uuid("benutzer_id").primaryKey(),
  email: text("email").notNull().unique(),
  rolle: rolle("rolle").notNull(),
  mitgliedId: uuid("mitglied_id").references(() => mitglied.mitgliedId),
  trainerId: uuid("trainer_id").references(() => trainer.trainerId),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
