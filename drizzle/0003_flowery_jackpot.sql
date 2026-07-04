CREATE TABLE "push_abo" (
	"abo_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mitglied_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_abo_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "push_abo" ADD CONSTRAINT "push_abo_mitglied_id_mitglied_mitglied_id_fk" FOREIGN KEY ("mitglied_id") REFERENCES "public"."mitglied"("mitglied_id") ON DELETE no action ON UPDATE no action;