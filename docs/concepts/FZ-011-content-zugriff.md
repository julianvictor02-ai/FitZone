# FZ-011 — Content-Zugriff nach Tarif

_Konzept / Plan. Quelle: `docs/spec.md §4 BR7`, §2b, §10. Status: done (On-Demand-Teil).
Livestream-Buchungs-Gate vertagt (spec §8 offen)._

## Ziel

On-Demand-Videos sind **tarifabhängig** sichtbar: On-Demand ab Plus; Basic sieht keine.
Einzelne Videos können zusätzlich **Premium** verlangen (`mindest_tarif`). Zugriff wird
server-seitig erzwungen (kein URL an nicht-berechtigte Mitglieder).

## Business Rule (BR7)

> Zugriff nur, wenn Tarif ausreicht: On-Demand ab Plus. Akzeptanz: Basic sieht keine
> On-Demand-Videos; Plus/Premium sehen On-Demand; unerlaubter Zugriff wird blockiert.
> Regel (spec §10): `mitglied.tarif >= video.mindest_tarif`.

## Akzeptanzkriterien (alle per `npm run verify:fz011` grün, 9/9)

- [x] `darfVideoSehen`: Basic < Plus, Plus sieht Plus (nicht Premium), Premium sieht alles.
- [x] Videoliste (server-seitig gefiltert): Basic → keine; Plus → nur Plus-Videos; Premium → alle.
- [x] Basic bekommt keine Video-URL ausgeliefert (Zugriff blockiert).

## Lösungsansatz

- `lib/content/zugriff.ts`: ordinale `TARIF_RANG` (Basic<Plus<Premium); `darfVideoSehen(tarif,
  mindestTarif)`; `erlaubteVideoTarife(tarif)` für den Query-Filter.
- `app/videos/page.tsx` (RSC): `requireRolle("mitglied")`, lädt Tarif, filtert
  `on_demand_video.mindest_tarif ∈ erlaubteVideoTarife(tarif)`. Basic → Hinweis statt Liste.
- `app/page.tsx`: Nav-Link „Videos" für Rolle `mitglied`.
- `scripts/bootstrap.ts`: 3 Demo-Videos (Plus/Plus/Premium), nur wenn noch keine existieren.

## Vertagt / offen (spec §8)

- **Livestream-Buchungs-Gate für Basic**: „Basic = nur Studio genannt, Livestream unklar."
  Bewusst **nicht** umgesetzt — ein Gate würde Basic-Buchungsverhalten ändern; ohne
  Kundenfreigabe bleibt es offen. Bei „Nein" später zentral über `tarif.livestream_zugriff`
  in `bucheKurstermin` + `warteAufKurstermin` (neuer Status z. B. `kein_livestream_zugriff`).
- **Play-/Detail-Route**: nicht vorhanden; die Listenfilterung ist die Durchsetzung. Eine
  spätere Play-Route muss `darfVideoSehen` erneut prüfen.
- On-Demand-Feinsteuerung (Vimeo-Workaround) ist ohnehin „Später" (FZ-015).
