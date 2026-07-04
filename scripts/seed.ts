import { db } from "../lib/db";
import { tarif, kurstyp } from "../lib/db/schema";

// Referenzdaten-Seed: die drei Tarife (Werte aus spec.md §2/§9, BR4/BR7) und die
// fünf Kurstypen. Idempotent über onConflictDoNothing (Unique auf name).
// Ausführen: `npm run db:seed` (benötigt DATABASE_URL in .env.local).
async function seed() {
  await db
    .insert(tarif)
    .values([
      // Basic: 5 Buchungen/Monat, kein On-Demand, kein Livestream (nur Studio) —
      // Kundenentscheidung Lisa 2026-07-04 (spec §8, Frage 4).
      {
        name: "Basic",
        buchungslimitProMonat: 5,
        onDemandZugriff: false,
        livestreamZugriff: false,
        stornoGebuehrBefreit: false,
        earlyAccess: false,
      },
      // Plus: kein festes Limit, On-Demand + Livestream.
      {
        name: "Plus",
        buchungslimitProMonat: null,
        onDemandZugriff: true,
        livestreamZugriff: true,
        stornoGebuehrBefreit: false,
        earlyAccess: false,
      },
      // Premium: unbegrenzt, alles inkl., keine Stornogebühr.
      {
        name: "Premium",
        buchungslimitProMonat: null,
        onDemandZugriff: true,
        livestreamZugriff: true,
        stornoGebuehrBefreit: true,
        earlyAccess: false,
      },
    ])
    .onConflictDoNothing({ target: tarif.name });

  await db
    .insert(kurstyp)
    .values([
      // Kapazitäten bewusst offen (spec §8) — später mit Marie/Tom fixieren.
      { name: "Yoga" },
      { name: "Pilates" },
      { name: "Spinning" },
      { name: "HIIT" },
      { name: "Bodyworkout" },
    ])
    .onConflictDoNothing({ target: kurstyp.name });

  console.log("Seed abgeschlossen: 3 Tarife + 5 Kurstypen.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
