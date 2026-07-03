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
  unique,
} from "drizzle-orm/pg-core";

// Datenmodell FitZone — Quelle: docs/architecture.md / docs/spec.md §10.
// Business Rules BR1–BR9 (Kapazität, Warteliste, Limits, Fristen) werden in der
// Anwendungs-/DB-Logik erzwungen, nicht allein durch dieses Schema.

// --- Enums ---
export const tarifName = pgEnum("tarif_name", ["Basic", "Plus", "Premium"]);
export const mitgliedStatus = pgEnum("mitglied_status", ["aktiv", "pausiert"]);
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
]);
export const buchungsstatus = pgEnum("buchungsstatus", ["bestaetigt", "storniert"]);
export const anwesenheit = pgEnum("anwesenheit", [
  "offen",
  "anwesend",
  "no_show",
  "entschuldigt",
]);
export const wartelisteStatus = pgEnum("warteliste_status", [
  "wartend",
  "benachrichtigt",
  "nachgerueckt",
  "abgelaufen",
]);

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
    stornoGebuehrFaellig: boolean("storno_gebuehr_faellig").notNull().default(false),
    stornoGebuehrBetrag: numeric("storno_gebuehr_betrag", { precision: 10, scale: 2 }),
    trainerNotiz: text("trainer_notiz"),
  },
  (t) => [unique("uq_buchung_mitglied_termin").on(t.mitgliedId, t.kursterminId)],
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
  (t) => [unique("uq_warteliste_mitglied_termin").on(t.mitgliedId, t.kursterminId)],
);
