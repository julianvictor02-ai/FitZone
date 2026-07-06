ALTER TABLE "push_abo" ALTER COLUMN "mitglied_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "push_abo" ADD COLUMN "trainer_id" uuid;--> statement-breakpoint
ALTER TABLE "push_abo" ADD CONSTRAINT "push_abo_trainer_id_trainer_trainer_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainer"("trainer_id") ON DELETE no action ON UPDATE no action;