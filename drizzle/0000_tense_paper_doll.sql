CREATE TYPE "public"."anwesenheit" AS ENUM('offen', 'anwesend', 'no_show', 'entschuldigt');--> statement-breakpoint
CREATE TYPE "public"."buchungsstatus" AS ENUM('bestaetigt', 'storniert');--> statement-breakpoint
CREATE TYPE "public"."kurstermin_status" AS ENUM('geplant', 'abgesagt', 'verschoben');--> statement-breakpoint
CREATE TYPE "public"."kurstyp_name" AS ENUM('Yoga', 'Pilates', 'Spinning', 'HIIT', 'Bodyworkout');--> statement-breakpoint
CREATE TYPE "public"."mitglied_status" AS ENUM('aktiv', 'pausiert');--> statement-breakpoint
CREATE TYPE "public"."modus" AS ENUM('Studio', 'Livestream');--> statement-breakpoint
CREATE TYPE "public"."rolle" AS ENUM('admin', 'trainer', 'mitglied');--> statement-breakpoint
CREATE TYPE "public"."tarif_name" AS ENUM('Basic', 'Plus', 'Premium');--> statement-breakpoint
CREATE TYPE "public"."warteliste_status" AS ENUM('wartend', 'benachrichtigt', 'nachgerueckt', 'abgelaufen');--> statement-breakpoint
CREATE TABLE "benutzer" (
	"benutzer_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"rolle" "rolle" NOT NULL,
	"mitglied_id" uuid,
	"trainer_id" uuid,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "benutzer_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "buchung" (
	"buchung_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mitglied_id" uuid NOT NULL,
	"kurstermin_id" uuid NOT NULL,
	"buchungsstatus" "buchungsstatus" DEFAULT 'bestaetigt' NOT NULL,
	"buchungszeitpunkt" timestamp with time zone DEFAULT now() NOT NULL,
	"stornozeitpunkt" timestamp with time zone,
	"anwesenheit" "anwesenheit" DEFAULT 'offen' NOT NULL,
	"storno_gebuehr_faellig" boolean DEFAULT false NOT NULL,
	"storno_gebuehr_betrag" numeric(10, 2),
	"trainer_notiz" text
);
--> statement-breakpoint
CREATE TABLE "kurstermin" (
	"kurstermin_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kurstyp_id" uuid NOT NULL,
	"trainer_id" uuid NOT NULL,
	"modus" "modus" NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"kapazitaet" integer NOT NULL,
	"status" "kurstermin_status" DEFAULT 'geplant' NOT NULL,
	"stream_link" text
);
--> statement-breakpoint
CREATE TABLE "kurstyp" (
	"kurstyp_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "kurstyp_name" NOT NULL,
	"standard_kapazitaet_studio" integer,
	"standard_kapazitaet_livestream" integer,
	CONSTRAINT "kurstyp_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "mitglied" (
	"mitglied_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tarif_id" uuid NOT NULL,
	"status" "mitglied_status" DEFAULT 'aktiv' NOT NULL,
	"mitgliedschaft_bis" date,
	"email" text NOT NULL,
	CONSTRAINT "mitglied_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "on_demand_video" (
	"video_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titel" text NOT NULL,
	"kurstyp_id" uuid,
	"level" text,
	"dauer_minuten" integer,
	"mindest_tarif" "tarif_name" NOT NULL,
	"plattform" text,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "tarif" (
	"tarif_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "tarif_name" NOT NULL,
	"monatspreis" numeric(10, 2),
	"buchungslimit_pro_monat" integer,
	"on_demand_zugriff" boolean DEFAULT false NOT NULL,
	"livestream_zugriff" boolean,
	"storno_gebuehr_befreit" boolean DEFAULT false NOT NULL,
	"early_access" boolean DEFAULT false NOT NULL,
	CONSTRAINT "tarif_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "trainer" (
	"trainer_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	CONSTRAINT "trainer_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wartelisteneintrag" (
	"wl_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mitglied_id" uuid NOT NULL,
	"kurstermin_id" uuid NOT NULL,
	"zeitstempel" timestamp with time zone DEFAULT now() NOT NULL,
	"position" integer,
	"status" "warteliste_status" DEFAULT 'wartend' NOT NULL,
	"benachrichtigt_am" timestamp with time zone,
	"frist_bis" timestamp with time zone,
	CONSTRAINT "uq_warteliste_mitglied_termin" UNIQUE("mitglied_id","kurstermin_id")
);
--> statement-breakpoint
ALTER TABLE "benutzer" ADD CONSTRAINT "benutzer_mitglied_id_mitglied_mitglied_id_fk" FOREIGN KEY ("mitglied_id") REFERENCES "public"."mitglied"("mitglied_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benutzer" ADD CONSTRAINT "benutzer_trainer_id_trainer_trainer_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainer"("trainer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buchung" ADD CONSTRAINT "buchung_mitglied_id_mitglied_mitglied_id_fk" FOREIGN KEY ("mitglied_id") REFERENCES "public"."mitglied"("mitglied_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buchung" ADD CONSTRAINT "buchung_kurstermin_id_kurstermin_kurstermin_id_fk" FOREIGN KEY ("kurstermin_id") REFERENCES "public"."kurstermin"("kurstermin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kurstermin" ADD CONSTRAINT "kurstermin_kurstyp_id_kurstyp_kurstyp_id_fk" FOREIGN KEY ("kurstyp_id") REFERENCES "public"."kurstyp"("kurstyp_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kurstermin" ADD CONSTRAINT "kurstermin_trainer_id_trainer_trainer_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainer"("trainer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mitglied" ADD CONSTRAINT "mitglied_tarif_id_tarif_tarif_id_fk" FOREIGN KEY ("tarif_id") REFERENCES "public"."tarif"("tarif_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "on_demand_video" ADD CONSTRAINT "on_demand_video_kurstyp_id_kurstyp_kurstyp_id_fk" FOREIGN KEY ("kurstyp_id") REFERENCES "public"."kurstyp"("kurstyp_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wartelisteneintrag" ADD CONSTRAINT "wartelisteneintrag_mitglied_id_mitglied_mitglied_id_fk" FOREIGN KEY ("mitglied_id") REFERENCES "public"."mitglied"("mitglied_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wartelisteneintrag" ADD CONSTRAINT "wartelisteneintrag_kurstermin_id_kurstermin_kurstermin_id_fk" FOREIGN KEY ("kurstermin_id") REFERENCES "public"."kurstermin"("kurstermin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_buchung_aktiv_mitglied_termin" ON "buchung" USING btree ("mitglied_id","kurstermin_id") WHERE "buchung"."buchungsstatus" = 'bestaetigt';