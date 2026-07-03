# SPEC.md

> **Modul:** Smart Applications (FitZone)
> **Quellen-Konvention:** Jede Aussage trägt ein Tag.
> `[Quelle: Rohprotokoll]` = direkt aus dem vollständigen Chatverlauf (höchste Priorität, gilt als Fakt).
> `[Quelle: Zusammenfassung]` = nur aus der KI-Zusammenfassung, im Rohprotokoll nicht wörtlich belegt.
> `[Annahme]` = Ableitung/Modellierungsvorschlag des Analysten, **kein** Fakt.
> `[Offene Frage]` = im Interview nicht abschließend geklärt.
>
> **Hinweis zur Meeting-Zuordnung:** Das Rohprotokoll liegt als **ein durchgehender Verlauf** (20 Fragen) vor und ist darin **nicht** in Meeting 1/2 getrennt. Die Aufteilung „Meeting 1 = 12 Fragen, Meeting 2 = 8 Fragen" stammt nur aus der Zusammenfassung `[Quelle: Zusammenfassung]`. Das Rohprotokoll bestätigt lediglich, dass es zwei Gespräche gab („was wir in beiden Gesprächen besprochen haben"). Deshalb werden Chat-Fakten mit `[Quelle: Rohprotokoll]` statt mit geratenen Meeting-Nummern getaggt.

---

## 1. Kontext

- **Kunde:** Lisa Sommer, Inhaberin `[Quelle: Rohprotokoll]`
- **Geschäft:** FitZone – Fitness-Studio (Berlin) mit drei Angebotskanälen: Vor-Ort-Studio-Kurse, Livestream-Kurse (aktuell via Zoom) und On-Demand-Videos (aktuell via Vimeo) `[Quelle: Rohprotokoll]`
- **Hauptproblem:** Kursbuchung, Warteliste, Absagen und Anwesenheit laufen vollständig manuell über Lisa (WhatsApp, Instagram-Stories, Excel auf mehreren Laptops mit unklarem Versionsstand). Folgen: verpasste/verzögerte Buchungen, unfaires Nachrücken, keine Buchungsnachweise/Zeitstempel, hoher Zeit- und Nervenaufwand. `[Quelle: Rohprotokoll]`
- **Ziel der App:** Mitglieder buchen/stornieren selbst mit automatischer Bestätigung; Warteliste rückt automatisch nach; alle Buchungen sind mit Zeitstempel nachweisbar; Trainer erfassen Anwesenheit selbst; klare Rollen- und Tarif-Steuerung. `[Quelle: Rohprotokoll]`
- **Scope von Version 1 (MVP):** Online-Kursbuchung mit Auto-Bestätigung, Warteliste mit automatischem Nachrücken + Benachrichtigung + harter Obergrenze, Selbst-Stornierung, Anwesenheitserfassung mit Zeitstempel, Trainer-Login (eigene Kurse + Abhaken), Mitgliederstammdaten (Tarif/Status, admin-gepflegt), Mitglieder-Selbstansicht (nur lesend), Auto-Benachrichtigung bei Kursausfall. Details siehe Abschnitt 7. `[Quelle: Rohprotokoll]`

---

## 2. Entitäten

> Modellierungsentscheidung: Die Zusammenfassung nennt „Kurs" als eine Entität. Für die Buchung ist die Trennung in **Kurstyp** (Yoga, Spinning, HIIT …, inkl. Standard-Kapazitäten) und **Kurstermin** (konkrete Session mit Datum/Uhrzeit/Kapazität) nötig, da gebucht wird auf Termin-Ebene, Regeln aber am Kurstyp hängen. `[Annahme]`

### Mitglied
- Beschreibung: Ein bei FitZone registriertes Mitglied mit genau einem Tarif. `[Quelle: Rohprotokoll]`
- Primärschlüssel: `mitglied_id`
- Attribute:
  - `mitglied_id` — UUID — Pflichtfeld: ja — Unique: ja — Default: – — Technischer Schlüssel `[Annahme]`
  - `name` — String — Pflichtfeld: ja — Unique: nein — Default: – — Anzeigename des Mitglieds `[Quelle: Rohprotokoll]`
  - `tarif_id` — UUID — Pflichtfeld: ja — Unique: nein — Default: – — FK auf Tarif `[Quelle: Rohprotokoll]`
  - `status` — Enum(`aktiv`,`pausiert`) — Pflichtfeld: ja — Unique: nein — Default: `aktiv` — Aktiv/Pausiert, nur Admin änderbar `[Quelle: Rohprotokoll]`
  - `mitgliedschaft_bis` — Date — Pflichtfeld: nein — Unique: nein — Default: – — Vertragslaufzeit, in Selbstansicht sichtbar `[Quelle: Rohprotokoll]`
  - `email` — String — Pflichtfeld: ja — Unique: ja — Default: – — Login/Benachrichtigung `[Annahme]`
  - `login_credential` — String — Pflichtfeld: ja — Unique: nein — Default: – — Auth; wird **nicht** im Klartext gespeichert `[Annahme]`
- Hinweise / Unsicherheiten: „Buchungshistorie" ist kein Attribut, sondern über Entität *Buchung* abgeleitet. Kontaktfelder (E-Mail/Telefon) sind im Rohprotokoll nicht genannt, aber für Login/Benachrichtigung nötig. `[Offene Frage]`

### Trainer
- Beschreibung: Kursleiter:in (z. B. Marie, Tom) mit eigenem Login und eingeschränkten Rechten. `[Quelle: Rohprotokoll]`
- Primärschlüssel: `trainer_id`
- Attribute:
  - `trainer_id` — UUID — Pflichtfeld: ja — Unique: ja — Default: – — Technischer Schlüssel `[Annahme]`
  - `name` — String — Pflichtfeld: ja — Unique: nein — Default: – — Anzeigename `[Quelle: Rohprotokoll]`
  - `email` — String — Pflichtfeld: ja — Unique: ja — Default: – — Login `[Annahme]`
- Hinweise / Unsicherheiten: Trainer sieht ausschließlich eigene Kurstermine (siehe Rollen/Beziehungen). `[Quelle: Rohprotokoll]`

### Tarif
- Beschreibung: Referenzentität mit genau drei Ausprägungen (Basic, Plus, Premium), die Rechte/Limits steuern. `[Quelle: Rohprotokoll]`
- Primärschlüssel: `tarif_id`
- Attribute:
  - `tarif_id` — UUID — Pflichtfeld: ja — Unique: ja — Default: – — Technischer Schlüssel `[Annahme]`
  - `name` — Enum(`Basic`,`Plus`,`Premium`) — Pflichtfeld: ja — Unique: ja — Default: – — Tarifname `[Quelle: Rohprotokoll]`
  - `monatspreis` — Decimal — Pflichtfeld: nein — Unique: nein — Default: – — Preise nicht erhoben (laut Lisa variabel) `[Quelle: Rohprotokoll]` / `[Offene Frage]`
  - `buchungslimit_pro_monat` — Integer — Pflichtfeld: nein — Unique: nein — Default: – — Basic = 5; Plus/Premium = `null` (unbegrenzt) `[Quelle: Rohprotokoll]`
  - `on_demand_zugriff` — Boolean — Pflichtfeld: ja — Unique: nein — Default: `false` — Basic=false, Plus=true, Premium=true `[Quelle: Rohprotokoll]`
  - `livestream_zugriff` — Boolean — Pflichtfeld: ja — Unique: nein — Default: – — Plus=true, Premium=true; **Basic unklar** `[Quelle: Rohprotokoll]` / `[Offene Frage]`
  - `storno_gebuehr_befreit` — Boolean — Pflichtfeld: ja — Unique: nein — Default: `false` — Premium=true `[Quelle: Rohprotokoll]`
  - `early_access` — Boolean — Pflichtfeld: ja — Unique: nein — Default: `false` — früheres Buchungsfenster; nur **Idee** von Lisa, nicht entschieden `[Quelle: Rohprotokoll]` / `[Offene Frage]`
- Hinweise / Unsicherheiten: Preise und die Basic-Livestream-Frage sind offen.

### Kurstyp
- Beschreibung: Kursart mit Standard-Kapazitäten je Modus (Yoga, Pilates, Spinning, HIIT, Bodyworkout). `[Quelle: Rohprotokoll]`
- Primärschlüssel: `kurstyp_id`
- Attribute:
  - `kurstyp_id` — UUID — Pflichtfeld: ja — Unique: ja — Default: – — Technischer Schlüssel `[Annahme]`
  - `name` — Enum(`Yoga`,`Pilates`,`Spinning`,`HIIT`,`Bodyworkout`) — Pflichtfeld: ja — Unique: ja — Default: – — Als Werte im Chat genannt `[Quelle: Rohprotokoll]`
  - `standard_kapazitaet_studio` — Integer — Pflichtfeld: nein — Unique: nein — Default: – — z. B. Yoga 12–15 (Mattenfläche); andere Typen offen `[Quelle: Rohprotokoll]` / `[Offene Frage]`
  - `standard_kapazitaet_livestream` — Integer — Pflichtfeld: nein — Unique: nein — Default: – — Yoga/Pilates ~15; HIIT ~20 (Pi mal Daumen, mit Trainern abzustimmen) `[Quelle: Rohprotokoll]` / `[Offene Frage]`
- Hinweise / Unsicherheiten: Kapazität ist kursabhängig, nicht global fix. Exakte Werte pro Typ noch mit Marie/Tom final abzustimmen. `[Quelle: Rohprotokoll]`

### Kurstermin
- Beschreibung: Konkrete, buchbare Kurs-Session zu Datum/Uhrzeit, mit Modus (Studio oder Livestream), Trainer und Kapazität. `[Quelle: Rohprotokoll]`
- Primärschlüssel: `kurstermin_id`
- Attribute:
  - `kurstermin_id` — UUID — Pflichtfeld: ja — Unique: ja — Default: – — Technischer Schlüssel `[Annahme]`
  - `kurstyp_id` — UUID — Pflichtfeld: ja — Unique: nein — Default: – — FK auf Kurstyp `[Annahme]`
  - `trainer_id` — UUID — Pflichtfeld: ja — Unique: nein — Default: – — FK auf Trainer `[Quelle: Rohprotokoll]`
  - `modus` — Enum(`Studio`,`Livestream`) — Pflichtfeld: ja — Unique: nein — Default: – — On-Demand ist bewusst **kein** Termin (kein Datum/keine Buchung) `[Quelle: Rohprotokoll]`
  - `start` — DateTime — Pflichtfeld: ja — Unique: nein — Default: – — Startzeitpunkt (Basis für Fristen) `[Quelle: Rohprotokoll]`
  - `kapazitaet` — Integer — Pflichtfeld: ja — Unique: nein — Default: – — Effektive Platzzahl (ableitbar aus Kurstyp/Modus, überschreibbar) `[Quelle: Rohprotokoll]`
  - `status` — Enum(`geplant`,`abgesagt`,`verschoben`) — Pflichtfeld: ja — Unique: nein — Default: `geplant` — Ausfall/Uhrzeitänderung `[Quelle: Rohprotokoll]`
  - `stream_link` — Text — Pflichtfeld: nein — Unique: nein — Default: – — Nur bei Livestream (Zoom-Link) `[Quelle: Rohprotokoll]`
- Status/Workflow:
  - Mögliche Zustände: `geplant`, `verschoben`, `abgesagt`
  - Erlaubte Übergänge: `geplant → verschoben`, `geplant → abgesagt`, `verschoben → abgesagt`. Bei `abgesagt`/`verschoben`: automatische Benachrichtigung aller Gebuchten. `[Quelle: Rohprotokoll]`

### Buchung
- Beschreibung: Verbindliche Anmeldung eines Mitglieds zu einem Kurstermin, inkl. Zeitstempel, Storno und Anwesenheit. `[Quelle: Rohprotokoll]`
- Primärschlüssel: `buchung_id`
- Attribute:
  - `buchung_id` — UUID — Pflichtfeld: ja — Unique: ja — Default: – — Technischer Schlüssel `[Annahme]`
  - `mitglied_id` — UUID — Pflichtfeld: ja — Unique: nein — Default: – — FK auf Mitglied `[Quelle: Rohprotokoll]`
  - `kurstermin_id` — UUID — Pflichtfeld: ja — Unique: nein — Default: – — FK auf Kurstermin `[Quelle: Rohprotokoll]`
  - `buchungsstatus` — Enum(`bestaetigt`,`storniert`) — Pflichtfeld: ja — Unique: nein — Default: `bestaetigt` — Auto-Bestätigung bei freiem Platz `[Quelle: Rohprotokoll]`
  - `buchungszeitpunkt` — DateTime — Pflichtfeld: ja — Unique: nein — Default: `now()` — **Nachweis-Zeitstempel, „nicht verhandelbar"** `[Quelle: Rohprotokoll]`
  - `stornozeitpunkt` — DateTime — Pflichtfeld: nein — Unique: nein — Default: – — Zeitpunkt der Stornierung `[Quelle: Rohprotokoll]`
  - `anwesenheit` — Enum(`offen`,`anwesend`,`no_show`,`entschuldigt`) — Pflichtfeld: ja — Unique: nein — Default: `offen` — Trainer hakt nach Kurs ab `[Quelle: Rohprotokoll]`
  - `storno_gebuehr_faellig` — Boolean — Pflichtfeld: ja — Unique: nein — Default: `false` — v1 nur Markierung, Abwicklung manuell `[Quelle: Rohprotokoll]`
  - `storno_gebuehr_betrag` — Decimal — Pflichtfeld: nein — Unique: nein — Default: – — später (50 % Kurspreis) `[Quelle: Rohprotokoll]` / `[Offene Frage]`
  - `trainer_notiz` — Text — Pflichtfeld: nein — Unique: nein — Default: – — z. B. „wirkte verletzt"; Should-have `[Quelle: Rohprotokoll]`
- Status/Workflow:
  - Mögliche Zustände (kombiniert Buchungsstatus + Anwesenheit): `bestaetigt/offen` → `bestaetigt/anwesend` | `bestaetigt/no_show` | `storniert`
  - Erlaubte Übergänge: `bestaetigt → storniert` (durch Mitglied/Admin); nach Kursende `offen → anwesend | no_show | entschuldigt` (durch Trainer/Admin). `[Quelle: Rohprotokoll]`
- Hinweise / Unsicherheiten: Unique-Constraint (mitglied_id, kurstermin_id) verhindert Doppelbuchung. „Kurspreis" als Basis der 50 %-Gebühr ist bei Flat-Tarifen unklar definiert. `[Offene Frage]`

### Wartelisteneintrag
- Beschreibung: Position eines Mitglieds in der Warteliste eines vollen Kurstermins mit Zeitstempel und Nachrück-Status. `[Quelle: Rohprotokoll]`
- Primärschlüssel: `wl_id`
- Attribute:
  - `wl_id` — UUID — Pflichtfeld: ja — Unique: ja — Default: – — Technischer Schlüssel `[Annahme]`
  - `mitglied_id` — UUID — Pflichtfeld: ja — Unique: nein — Default: – — FK auf Mitglied `[Quelle: Rohprotokoll]`
  - `kurstermin_id` — UUID — Pflichtfeld: ja — Unique: nein — Default: – — FK auf Kurstermin `[Quelle: Rohprotokoll]`
  - `zeitstempel` — DateTime — Pflichtfeld: ja — Unique: nein — Default: `now()` — Basis für FIFO-Reihenfolge `[Quelle: Rohprotokoll]`
  - `position` — Integer — Pflichtfeld: nein — Unique: nein — Default: – — Ableitbar aus Zeitstempel; als abfragbare Ordnung `[Quelle: Zusammenfassung]`
  - `status` — Enum(`wartend`,`benachrichtigt`,`nachgerueckt`,`abgelaufen`,`storniert`) — Pflichtfeld: ja — Unique: nein — Default: `wartend` — Ablauf beim Nachrücken `[Quelle: Rohprotokoll]`
  - `benachrichtigt_am` — DateTime — Pflichtfeld: nein — Unique: nein — Default: – — Start des Bestätigungsfensters `[Quelle: Rohprotokoll]`
  - `frist_bis` — DateTime — Pflichtfeld: nein — Unique: nein — Default: – — `benachrichtigt_am` + 30 Min `[Quelle: Rohprotokoll]`
- Status/Workflow:
  - Mögliche Zustände: `wartend`, `benachrichtigt`, `nachgerueckt`, `abgelaufen`, `storniert`
  - Erlaubte Übergänge: `wartend → benachrichtigt` (Platz frei) → `nachgerueckt` (Bestätigung ≤ 30 Min → erzeugt Buchung) | `abgelaufen` (keine Bestätigung → nächster rückt nach). `[Quelle: Rohprotokoll]`
- Hinweise / Unsicherheiten: Harte Obergrenze pro Kurstermin (Beispielwert 5), einheitlich für alle Tarife. Exakter Zahlwert offen. `[Quelle: Rohprotokoll]` / `[Offene Frage]`

### OnDemandVideo
- Beschreibung: Aufgezeichnetes Video ohne Termin/Buchung, kategorisiert und tarifabhängig sichtbar. `[Quelle: Rohprotokoll]`
- Primärschlüssel: `video_id`
- Attribute:
  - `video_id` — UUID — Pflichtfeld: ja — Unique: ja — Default: – — Technischer Schlüssel `[Annahme]`
  - `titel` — String — Pflichtfeld: ja — Unique: nein — Default: – — Videotitel `[Annahme]`
  - `kurstyp_id` — UUID — Pflichtfeld: nein — Unique: nein — Default: – — Kategorie nach Kurstyp `[Quelle: Rohprotokoll]`
  - `level` — Enum(`Anfaenger`,`Mittel`,`Fortgeschritten`) — Pflichtfeld: nein — Unique: nein — Default: – — Kategorie nach Level `[Quelle: Rohprotokoll]`
  - `dauer_minuten` — Integer — Pflichtfeld: nein — Unique: nein — Default: – — Kategorie nach Dauer `[Quelle: Rohprotokoll]`
  - `mindest_tarif` — Enum(`Plus`,`Premium`) — Pflichtfeld: ja — Unique: nein — Default: `Plus` — Zugriff ab Tarifstufe `[Quelle: Rohprotokoll]`
  - `plattform` — String — Pflichtfeld: nein — Unique: nein — Default: `Vimeo` — Aktuell Vimeo `[Quelle: Rohprotokoll]`
  - `url` — String — Pflichtfeld: nein — Unique: nein — Default: – — Externer Link `[Quelle: Rohprotokoll]`
- Hinweise / Unsicherheiten: Bewusst **nicht** Tag-1-Scope. `[Quelle: Rohprotokoll]`

---

## 2b. Rollen & Berechtigungen

### Admin (Lisa)
- Beschreibung: Vollständige Kontrolle über alle Daten; entscheidet Ausnahmen (No-Show, Storno-Gebühr, Pausieren, Tarifwechsel) manuell. `[Quelle: Rohprotokoll]`
- Zugriff auf Entitäten (CRUD je Entität):
  - Mitglied: C/R/U/D (inkl. Tarifwechsel, Pausieren) `[Quelle: Rohprotokoll]`
  - Trainer: C/R/U/D `[Annahme]`
  - Tarif: C/R/U/D `[Annahme]`
  - Kurstyp: C/R/U/D `[Annahme]`
  - Kurstermin: C/R/U/D (Ausfall/Uhrzeit ändern) `[Quelle: Rohprotokoll]`
  - Buchung: C/R/U/D `[Quelle: Rohprotokoll]`
  - Wartelisteneintrag: C/R/U/D `[Quelle: Rohprotokoll]`
  - OnDemandVideo: C/R/U/D `[Quelle: Rohprotokoll]`
- Quelle: Rohprotokoll

### Trainer (Marie, Tom)
- Beschreibung: Eigener Login; sieht nur eigene Kurstermine, hakt Anwesenheit ab, hinterlässt Notizen. `[Quelle: Rohprotokoll]`
- Zugriff auf Entitäten (CRUD je Entität):
  - Kurstermin: R (nur eigene) `[Quelle: Rohprotokoll]`
  - Buchung: R (Teilnehmer eigener Kurse), U (nur `anwesenheit` + `trainer_notiz`) `[Quelle: Rohprotokoll]`
  - Mitglied: kein Zugriff `[Quelle: Rohprotokoll]`
  - Tarif: kein Zugriff `[Quelle: Rohprotokoll]`
  - Fremde Kurstermine anderer Trainer: kein Zugriff `[Quelle: Rohprotokoll]`
  - Kurs(termin)-Stammdaten ändern: nicht erlaubt `[Quelle: Rohprotokoll]`
- Quelle: Rohprotokoll

### Mitglied
- Beschreibung: Bucht/storniert selbst, sieht nur eigene Daten; keine Namen anderer Mitglieder. `[Quelle: Rohprotokoll]`
- Zugriff auf Entitäten (CRUD je Entität):
  - Buchung: C (self), R (nur eigene), U→`storniert` (nur eigene). Kein D (Historie/Nachweis bleibt) `[Quelle: Rohprotokoll]` / `[Annahme: kein Hard-Delete]`
  - Wartelisteneintrag: C (self), R (nur eigene), U→Bestätigung/Abmeldung `[Quelle: Rohprotokoll]`
  - Mitglied (eigener Datensatz): R (Tarif, Status, `mitgliedschaft_bis`, eigene Buchungen). **Kein** Ändern/Pausieren/Tarifwechsel `[Quelle: Rohprotokoll]`
  - Kurstermin: R eingeschränkt — nur freie Plätze als Zahl, **keine** Teilnehmernamen `[Quelle: Rohprotokoll]`
  - OnDemandVideo: R nur wenn Tarif ausreicht (Plus/Premium) `[Quelle: Rohprotokoll]`
- Quelle: Rohprotokoll

---

## 3. Beziehungen

### Mitglied ↔ Kurstermin (über Buchung)
- Kardinalität: **n:m**
- Beschreibung: Ein Mitglied bucht viele Kurstermine; ein Kurstermin hat viele gebuchte Mitglieder. Junction = *Buchung*.
- Pflicht oder optional: optional (Mitglied muss nicht buchen)
- Beziehungsattribute: `buchungszeitpunkt`, `buchungsstatus`, `stornozeitpunkt`, `anwesenheit`, `storno_gebuehr_faellig`
- Begründung aus dem Chat: Anmeldung mit Zeitstempel/Anwesenheit/Storno pro Mitglied und Termin. `[Quelle: Rohprotokoll]`

### Mitglied ↔ Kurstermin (über Wartelisteneintrag)
- Kardinalität: **n:m**
- Beschreibung: Ein Mitglied kann auf mehreren Wartelisten stehen; ein Termin hat mehrere Wartende. Junction = *Wartelisteneintrag*.
- Pflicht oder optional: optional
- Beziehungsattribute: `zeitstempel`, `position`, `status`, `frist_bis`
- Begründung aus dem Chat: FIFO-Warteliste mit Nachrücken/30-Min-Fenster. `[Quelle: Rohprotokoll]`

### Mitglied ↔ Tarif
- Kardinalität: 1:n (ein Tarif hat viele Mitglieder; ein Mitglied hat genau einen Tarif)
- Beschreibung: Tarif steuert Limits/Zugriffe des Mitglieds.
- Pflicht oder optional: Pflicht (jedes Mitglied hat einen Tarif)
- Beziehungsattribute: –
- Begründung aus dem Chat: Basic/Plus/Premium pro Mitglied. `[Quelle: Rohprotokoll]`

### Trainer ↔ Kurstermin
- Kardinalität: 1:n
- Beschreibung: Ein Trainer leitet viele Termine; jeder Termin hat einen verantwortlichen Trainer. Trainer sieht nur eigene.
- Pflicht oder optional: Pflicht (Termin braucht Trainer)
- Beziehungsattribute: –
- Begründung aus dem Chat: „eigener Kursplan", Sichtbarkeit auf eigene Kurse begrenzt. `[Quelle: Rohprotokoll]`

### Kurstyp ↔ Kurstermin
- Kardinalität: 1:n
- Beschreibung: Kurstyp liefert Standard-Kapazitäten; Termin ist eine Instanz eines Typs.
- Pflicht oder optional: Pflicht
- Beziehungsattribute: –
- Begründung aus dem Chat: Kapazität ist kursabhängig (Yoga vs. HIIT). `[Quelle: Rohprotokoll]`

### Tarif ↔ OnDemandVideo (Zugriff)
- Kardinalität: **n:m** (jeder Tarif ab Mindeststufe sieht viele Videos; jedes Video ist für mehrere Tarife sichtbar)
- Beschreibung: Zugriffsrecht Tarif→Video. Implementierbar als `mindest_tarif` (ordinale Schwelle) statt echter Junction.
- Pflicht oder optional: optional
- Beziehungsattribute: – (bzw. `mindest_tarif`)
- Begründung aus dem Chat: „nicht jedes Mitglied sieht alles, hängt vom Tarif ab". `[Quelle: Rohprotokoll]`

---

## 4. Business Rules

- **BR1 – Auto-Buchung mit Bestätigung**
  - Wenn ein Mitglied einen Kurstermin bucht und `bestätigte Buchungen < kapazitaet`,
  - Dann wird die Buchung mit `buchungsstatus=bestaetigt` + `buchungszeitpunkt` angelegt und automatisch bestätigt (ohne Admin).
  - Betroffene Entitäten: Buchung, Kurstermin, Mitglied
  - Akzeptanzkriterium: Bei freiem Platz erhält das Mitglied ohne manuelles Zutun eine Bestätigung; ein Zeitstempel ist gespeichert und abrufbar.
  - Offene Punkte: Buchungsschluss (Frist vor Start, s. BR5) – global 2 h oder pro Kurstyp? `[Offene Frage]`
  - Quelle: `[Quelle: Rohprotokoll]`

- **BR2 – Warteliste bei vollem Kurs (FIFO + 30-Min-Fenster + harte Obergrenze)**
  - Wenn ein Kurstermin voll ist und ein Mitglied buchen will und `Wartelistenlänge < max_wartelistengroesse`,
  - Dann Aufnahme als Wartelisteneintrag (`status=wartend`, `zeitstempel`). Wird ein Platz frei, wird der/die Erste benachrichtigt (`benachrichtigt`, `frist_bis = jetzt + 30 Min`); bei Bestätigung → Buchung (`nachgerueckt`), sonst `abgelaufen` und der/die Nächste rückt nach.
  - Betroffene Entitäten: Wartelisteneintrag, Buchung, Kurstermin
  - Akzeptanzkriterium: Nachrücken folgt strikt dem ältesten `zeitstempel`; nach 30 Min ohne Bestätigung rückt automatisch der/die Nächste nach; Warteliste nimmt keine Einträge über der Obergrenze an.
  - Offene Punkte: Konkreter Zahlwert der Obergrenze (Beispiel: 5); Benachrichtigungskanal (Push/E-Mail/SMS). `[Offene Frage]`
  - Quelle: `[Quelle: Rohprotokoll]`

- **BR3 – Wartelisten-Obergrenze gilt einheitlich (kein Premium-Vordrängeln)**
  - Wenn ein Premium-Mitglied auf eine Warteliste will,
  - Dann gelten dieselbe Obergrenze und dieselbe FIFO-Reihenfolge wie für alle; Premium erhält **keine** Sonderposition beim Nachrücken.
  - Betroffene Entitäten: Wartelisteneintrag, Tarif
  - Akzeptanzkriterium: Reihenfolge/Obergrenze sind tarif-unabhängig; ein Premium-Eintrag überspringt keine älteren Einträge.
  - Offene Punkte: Möglicher Ausgleich „früheres Buchungsfenster (Early Access)" – nur Idee, nicht entschieden (s. BR8). `[Offene Frage]`
  - Quelle: `[Quelle: Rohprotokoll]`

- **BR4 – Buchungslimits pro Tarif**
  - Wenn ein Basic-Mitglied bucht,
  - Dann max. 5 Buchungen pro Monat (hart); Plus = kein festes Limit; Premium = unbegrenzt.
  - Betroffene Entitäten: Tarif, Buchung, Mitglied
  - Akzeptanzkriterium: 6. Basic-Buchung im selben Monat wird abgelehnt; Plus/Premium werden nicht durch ein Zähllimit blockiert.
  - Offene Punkte: Widerspruch „6 Kurse/Woche" (illustrativ) vs. „5 Buchungen/Monat" (s. Abschnitt 5, W3); zählt „pro Monat" Kalendermonat oder rollierend? `[Offene Frage]`
  - Quelle: `[Quelle: Rohprotokoll]`

- **BR5 – Storno- und Buchungsfristen**
  - Wenn eine Stornierung/Buchung nach der Frist (Lisas Richtwert: 2 h vor Start, Beispiel HIIT 18:00 → Grenze 16:00) erfolgt,
  - Dann bei Nicht-Premium `storno_gebuehr_faellig=true` (Richtwert 50 % Kurspreis); Premium ist grundsätzlich befreit.
  - Betroffene Entitäten: Buchung, Kurstermin, Tarif
  - Akzeptanzkriterium: Bei Storno wird `stornozeitpunkt` gespeichert; System markiert Gebührenpflicht korrekt anhand Frist und Tarif; Admin kann Betrag manuell abwickeln (v1 keine Auto-Abbuchung).
  - Offene Punkte: 2 h ist Lisas „gedachte Grenze", nicht offiziell fixiert; gilt sie global oder pro Kurstyp?; Definition „Kurspreis" bei Flat-Tarifen. `[Offene Frage]`
  - Quelle: `[Quelle: Rohprotokoll]`

- **BR6 – No-Show-Tracking (auch Premium), aber keine Auto-Sperre**
  - Wenn ein Mitglied wiederholt gebucht hat und `anwesenheit=no_show` (ohne Absage),
  - Dann zählt das System die No-Shows und informiert den Admin; **keine** automatische Sperre – auch Premium bleibt buchbar.
  - Betroffene Entitäten: Buchung, Mitglied, Tarif
  - Akzeptanzkriterium: No-Shows sind pro Mitglied auswertbar; ab einer Schwelle (Lisa nannte „3–4 Mal") erhält der Admin einen Hinweis; die Entscheidung über Konsequenzen bleibt manuell.
  - Offene Punkte: Exakte Schwelle und Zeitfenster (3–4 hintereinander? pro Monat?). `[Offene Frage]`
  - Quelle: `[Quelle: Rohprotokoll]`

- **BR7 – Content-Zugriff nach Tarif**
  - Wenn ein Mitglied ein On-Demand-Video (oder Livestream) öffnen will,
  - Dann Zugriff nur, wenn Tarif ausreicht: On-Demand ab Plus; Livestream ab Plus; Basic = nur Studio (Basic-Livestream unklar).
  - Betroffene Entitäten: Tarif, OnDemandVideo, Kurstermin, Mitglied
  - Akzeptanzkriterium: Basic sieht keine On-Demand-Videos; Plus/Premium sehen On-Demand; unerlaubter Zugriff wird blockiert.
  - Offene Punkte: Darf Basic Livestreams buchen? Im Rohprotokoll nicht bestätigt. `[Offene Frage]`
  - Quelle: `[Quelle: Rohprotokoll]`

- **BR8 – Kursausfall/-änderung benachrichtigt automatisch**
  - Wenn ein Kurstermin `abgesagt` oder `verschoben` wird,
  - Dann erhalten alle gebuchten Mitglieder (und ggf. Wartende) automatisch eine Benachrichtigung.
  - Betroffene Entitäten: Kurstermin, Buchung, Wartelisteneintrag, Mitglied
  - Akzeptanzkriterium: Statuswechsel löst nachweislich Benachrichtigung an alle Betroffenen aus; niemand steht „vor verschlossener Tür".
  - Offene Punkte: Kanäle (Push/E-Mail/SMS); Umgang mit fehlerhaftem Stream-Link (nur neu ausspielen?). `[Offene Frage]`
  - Quelle: `[Quelle: Rohprotokoll]`

- **BR9 – Early-Access-Buchungsfenster für Premium (Kandidat, nicht entschieden)**
  - Wenn `early_access` für Premium aktiviert wäre,
  - Dann öffnet das Buchungsfenster für Premium früher als für Basic/Plus.
  - Betroffene Entitäten: Tarif, Kurstermin, Buchung
  - Akzeptanzkriterium: (nur falls beschlossen) Premium kann X Zeit vor anderen buchen; Warteliste bleibt trotzdem FIFO/einheitlich.
  - Offene Punkte: Ob überhaupt, für welche Tarife, wie viel früher – reine Idee von Lisa. `[Offene Frage]`
  - Quelle: `[Quelle: Rohprotokoll]`

---

## 5. Widersprüche und Auflösung

### Widerspruch 1 — Premium „unbegrenzt/keine Gebühr" vs. No-Show-Ärgernis
- Aussage A: Premium bucht unbegrenzt und zahlt keine Stornogebühr. `[Quelle: Rohprotokoll]`
- Aussage B: Manche Premium-Mitglieder blockieren Plätze durch wiederholtes Nicht-Erscheinen (stört Lisa). `[Quelle: Rohprotokoll]`
- Interpretation: Von Lisa im Chat selbst aufgelöst.
- Arbeitsannahme für v1: Keine Stornogebühr/kein Limit für Premium **bleibt**; zusätzlich **No-Show-Tracking + Admin-Info**, aber **keine** automatische Sperre. Konsequenz entscheidet Admin pro Fall. `[Quelle: Rohprotokoll]`

### Widerspruch 2 — Harte Wartelisten-Obergrenze vs. Premium „praktisch unbegrenzt"
- Aussage A: Warteliste bekommt eine harte Obergrenze für alle (Fairness). `[Quelle: Rohprotokoll]`
- Aussage B: Premium soll praktisch unbegrenzt buchen können. `[Quelle: Rohprotokoll]`
- Interpretation: Von Lisa aufgelöst.
- Arbeitsannahme für v1: Obergrenze und FIFO gelten **einheitlich**; Premium-Vorteil verlagert sich (optional) auf ein **früheres Buchungsfenster**, nicht auf Vordrängeln in der Warteliste. `[Quelle: Rohprotokoll]`

### Widerspruch 3 — Basic-Limit: „6 Kurse/Woche" vs. „5 Buchungen/Monat"
- Aussage A: Wenn Kevin (Basic) „sechs Kurse in einer Woche" bucht, würde Lisa stoppen. `[Quelle: Rohprotokoll]`
- Aussage B: Für Basic gilt „fünf Buchungen im Monat, mehr geht nicht". `[Quelle: Rohprotokoll]`
- Interpretation: Zwei unterschiedliche Einheiten (Woche vs. Monat). Die spätere, konkretere Zahl ist das gewollte Limit.
- Arbeitsannahme für v1: Basic = **5 Buchungen/Monat (hart)**. Die „6/Woche"-Aussage war illustrativ. Muss in Meeting bestätigt werden (Kalendermonat vs. rollierend). `[Annahme]` / `[Offene Frage]`

### Widerspruch 4 — Plus: „gewisse Grenzen" vs. „kein festes Limit"
- Aussage A: „Da gelten auch bei Plus noch gewisse Grenzen." `[Quelle: Rohprotokoll]`
- Aussage B: „Für Plus gibt es eigentlich kein hartes monatliches Limit … das No-Show-System greift genauso." `[Quelle: Rohprotokoll]`
- Interpretation: Lisa revidiert sich später bewusst.
- Arbeitsannahme für v1: Plus = **kein festes Buchungslimit**; steuernd wirkt stattdessen das No-Show-Tracking (BR6). `[Quelle: Rohprotokoll]`

---

## 6. Nicht-funktionale Anforderungen

- Performance: Nicht besprochen. `[Offene Frage]`
- Mandantenfähigkeit (Multi-Tenancy): Nicht besprochen. Arbeitsannahme v1: **Single-Tenant** (nur FitZone). `[Annahme]` / `[Offene Frage]`
- Authentifizierung/Autorisierung: Drei Rollen mit klar getrennten Rechten (Admin/Trainer/Mitglied) sind gefordert → rollenbasierte Zugriffskontrolle nötig. Konkrete Auth-Mechanik (Passwort-Policy, SSO, 2FA) nicht besprochen. `[Quelle: Rohprotokoll]` (Rollen) / `[Offene Frage]` (Mechanik)
- Datenschutz/Compliance: Mitglieder sehen nur eigene Daten; **keine** Namen anderer Mitglieder (nur freie-Plätze-Zahl); Trainer sehen nur eigene Kurse, keine Mitglieds-/Tarifdaten. DSGVO-Gesamtbetrachtung (Berlin/DE) nicht explizit besprochen. `[Quelle: Rohprotokoll]` (Sichtbarkeitsregeln) / `[Offene Frage]` (DSGVO-Details)
- Sonstiges: Buchungsnachweis mit Zeitstempel ist zwingend („nicht verhandelbar") – impliziert revisionssichere/auditierbare Buchungshistorie. `[Quelle: Rohprotokoll]`

---

## 7. Prioritäten

### Must-have für v1
- Online-Kursbuchung mit automatischer Bestätigung (Schmerzpunkt Nr. 1) `[Quelle: Rohprotokoll]`
- Warteliste: automatisches Nachrücken + Benachrichtigung + 30-Min-Fenster + harte Obergrenze `[Quelle: Rohprotokoll]`
- Selbst-Stornierung durch Mitglieder `[Quelle: Rohprotokoll]`
- Anwesenheitserfassung mit Zeitstempel (Trainer hakt selbst ab) `[Quelle: Rohprotokoll]`
- Trainer-Login: eigener Kursplan + Anwesenheit abhaken `[Quelle: Rohprotokoll]`
- Mitgliederstammdaten als Basis (Tarif, Status), admin-gepflegt `[Quelle: Rohprotokoll]`
- Mitglieder-Selbstansicht (eigener Tarif, `mitgliedschaft_bis`, eigene Buchungen – nur lesend) `[Quelle: Rohprotokoll]`
- Buchungsnachweis/Zeitstempel für alle Vorgänge `[Quelle: Rohprotokoll]`
- Auto-Benachrichtigung bei Kursausfall/-verschiebung `[Quelle: Rohprotokoll]`

### Should-have
- Trainer-Notizen zu Teilnehmern (z. B. „wirkte verletzt") `[Quelle: Rohprotokoll]`
- No-Show-Auswertung mit Admin-Hinweis ab Schwelle `[Quelle: Rohprotokoll]`
- Early-Access-Buchungsfenster für Premium (Kandidat) `[Quelle: Rohprotokoll]`

### Später / offen
- On-Demand-Video-Feinsteuerung (Vimeo-Workaround reicht vorerst) `[Quelle: Rohprotokoll]`
- Stornogebühren-**Automatik** (Berechnung/Abbuchung); v1 nur Zeitstempel + manuelle Abwicklung `[Quelle: Rohprotokoll]`
- Selbstständiger Tarifwechsel/Pausieren durch Mitglieder – **bewusst dauerhaft** Admin-Sache `[Quelle: Rohprotokoll]`

---

## 8. Offene Fragen für Meeting 2

> (Teile hiervon wurden im Rohprotokoll bereits beantwortet; verbleiben folgende echte Klärungspunkte.)

- Exakter Zahlwert der **Wartelisten-Obergrenze** (Beispiel 5?) und ob pro Kurstermin oder pro Kurstyp. `[Offene Frage]`
- **Basic-Limit** final: 5/Monat hart? Kalendermonat oder rollierend? Verhältnis zur „6/Woche"-Aussage. `[Offene Frage]`
- **Plus-Limit**: bestätigen, dass es kein festes Limit gibt. `[Offene Frage]`
- Darf **Basic Livestreams** buchen (nur Studio genannt, Livestream unklar)? `[Offene Frage]`
- **Kapazitäten je Livestream-Kurstyp** (Yoga/Pilates 15 gesetzt; HIIT/Bodyworkout ~20 „Pi mal Daumen") mit Marie/Tom fixieren; Studio-Kapazitäten anderer Typen außer Yoga (12–15). `[Offene Frage]`
- **Storno-/Buchungsfrist**: 2 h offiziell fixieren; global oder pro Kurstyp. `[Offene Frage]`
- **Storno-Gebühr**: „50 % Kurspreis" – Definition „Kurspreis" bei Flat-Tarifen; wie wird abgerechnet. `[Offene Frage]`
- **No-Show-Schwelle** für Admin-Hinweis (3–4 Mal? Zeitraum?). `[Offene Frage]`
- **Early Access**: einführen? Für welche Tarife, wie viel früher? `[Offene Frage]`
- **Benachrichtigungskanäle** (Push/E-Mail/SMS) für Bestätigung, Nachrücken, Ausfall. `[Offene Frage]`
- **Tarifpreise** erheben. `[Offene Frage]`
- **Kontaktdaten/Login-Mechanik** der Mitglieder/Trainer (E-Mail, Passwort-Policy). `[Offene Frage]`

---

## 9. Glossar

- **Basic / Plus / Premium** — Die drei Tarifstufen. Basic: Studio-Fokus, kein On-Demand, 5 Buchungen/Monat. Plus: Studio + Online (On-Demand + Livestream), kein festes Limit. Premium: alles inklusive, unbegrenzt, keine Stornogebühr. `[Quelle: Rohprotokoll]`
- **Studio-Kurs** — Präsenzkurs vor Ort mit physischer Raum-/Mattenkapazität. `[Quelle: Rohprotokoll]`
- **Livestream-Kurs** — Live per Zoom übertragener Kurs; buchbar wie Studio, aber Kapazität bewusst begrenzt (Betreuungsqualität). `[Quelle: Rohprotokoll]`
- **On-Demand** — Aufgezeichnete Videos (Vimeo) ohne Termin/Buchung, tarifabhängig sichtbar. `[Quelle: Rohprotokoll]`
- **Warteliste / Nachrücken** — FIFO-Liste für volle Kurse; bei freiem Platz rückt der/die Nächste nach (30-Min-Bestätigungsfenster), harte Obergrenze. `[Quelle: Rohprotokoll]`
- **No-Show** — Gebucht, aber ohne Absage nicht erschienen; blockiert Plätze. `[Quelle: Rohprotokoll]`
- **Storno / Stornogebühr** — Absage; bei zu kurzfristiger Absage Gebühr (Richtwert 50 %), Premium befreit. `[Quelle: Rohprotokoll]`
- **Buchungsfenster / Early Access** — (Kandidat) früherer Buchungsstart für Premium. `[Quelle: Rohprotokoll]`
- **Anwesenheitserfassung** — Trainer hakt nach dem Kurs ab, wer da war / no_show / entschuldigt. `[Quelle: Rohprotokoll]`
- **Buchungsnachweis/Zeitstempel** — Nachvollziehbarer Zeitpunkt jeder Buchung (löst Streitfälle „ich hab gebucht"). `[Quelle: Rohprotokoll]`

---

## 10. Vorschlag für Datenmodell

**Kern-Tabellen**
- `mitglied` (mitglied_id PK, name, tarif_id FK, status, mitgliedschaft_bis, email, …)
- `trainer` (trainer_id PK, name, email)
- `tarif` (tarif_id PK, name, monatspreis?, buchungslimit_pro_monat?, on_demand_zugriff, livestream_zugriff?, storno_gebuehr_befreit, early_access)
- `kurstyp` (kurstyp_id PK, name, standard_kapazitaet_studio?, standard_kapazitaet_livestream?)
- `kurstermin` (kurstermin_id PK, kurstyp_id FK, trainer_id FK, modus, start, kapazitaet, status, stream_link?)
- `on_demand_video` (video_id PK, titel, kurstyp_id FK?, level?, dauer_minuten?, mindest_tarif, plattform, url)

**Junction-Tabellen (n:m)**
- `buchung` (buchung_id PK, mitglied_id FK, kurstermin_id FK, buchungsstatus, buchungszeitpunkt, stornozeitpunkt?, anwesenheit, storno_gebuehr_faellig, storno_gebuehr_betrag?, trainer_notiz?) — **Unique(mitglied_id, kurstermin_id)**
- `wartelisteneintrag` (wl_id PK, mitglied_id FK, kurstermin_id FK, zeitstempel, position?, status, benachrichtigt_am?, frist_bis?) — **Unique(mitglied_id, kurstermin_id)**

**Kritische Validierungen**
- Buchung nur wenn `count(bestätigte Buchungen) < kurstermin.kapazitaet`; sonst Warteliste. (BR1/BR2)
- Wartelisten-Insert nur wenn `count(wartend) < max_wartelistengroesse`. (BR2)
- Basic: `count(Buchungen im Monat) < 5`. (BR4)
- Content-Zugriff: `mitglied.tarif >= video.mindest_tarif`. (BR7)
- Storno: setzt `stornozeitpunkt`; `storno_gebuehr_faellig = (nicht Premium) AND (stornozeitpunkt > start − frist)`. (BR5)
- Nachrücken: sortiere Wartende nach `zeitstempel` ASC; `frist_bis = benachrichtigt_am + 30 Min`; nach Ablauf nächster Eintrag. (BR2)
- Zeitstempel-Pflicht auf `buchung.buchungszeitpunkt` (Nachweis). (NFR)
- Sichtbarkeit: Mitglieder-Query liefert Kurstermin nur mit `freie_plaetze` (Zahl), keine Teilnehmernamen. (Datenschutz)

---

## 11. Hinweise fürs Vibe Coding

**Reihenfolge der Flows (zuerst bauen)**
1. **Mitglied bucht Kurstermin** (BR1): Terminliste → „buchen" → Auto-Bestätigung + Zeitstempel. Der wichtigste Flow überhaupt.
2. **Voll → Warteliste + Nachrücken** (BR2/BR3): Aufnahme, freier Platz → Benachrichtigung → 30-Min-Fenster → Buchung oder nächster. Muss zeitgleich mit Buchung stehen (sonst „Excel in App kopiert").
3. **Selbst-Stornierung** (BR5): mit `stornozeitpunkt` + Gebühren-Markierung (nur Flag, keine Abbuchung in v1).
4. **Trainer-Login + Anwesenheit abhaken** (Anwesenheit-Enum): nur eigene Termine.
5. **Admin: Mitglieder-/Tarif-/Terminverwaltung** + **Kursausfall-Benachrichtigung** (BR8).
6. **Mitglieder-Selbstansicht** (read-only Dashboard).

**UI-Masken (aus dem Modell abgeleitet)**
- Kurs-/Terminliste mit Modus-Filter (Studio/Livestream) und „freie Plätze"-Zähler (keine Namen).
- Buchungs-/Storno-Dialog mit Fristhinweis; Warteliste-Beitritt bei vollem Kurs.
- Mein Bereich (Mitglied): Tarif, `mitgliedschaft_bis`, eigene Buchungen/Historie, Wartelisten-Status.
- Trainer-Ansicht: eigener Kursplan, Teilnehmerliste, Anwesenheit-Checkliste, Notizfeld.
- Admin-Konsole: Mitglieder (Tarif/Status/Pausieren), Kurstermine (anlegen/absagen/verschieben), No-Show-Report, Storno-Report mit Zeitstempeln.

**Technisch zwingend zu validieren (Bezug zu Abschnitt 4)**
- Kapazitätsprüfung server-seitig, atomar (Race Conditions beim gleichzeitigen Buchen des letzten Platzes). (BR1)
- FIFO strikt über `zeitstempel`; 30-Min-Fenster als Server-Timer/Job. (BR2)
- Einheitliche Wartelisten-Obergrenze, tarif-unabhängig. (BR3)
- Basic-Monatslimit 5. (BR4)
- Tarif-basierte Content-Autorisierung. (BR7)
- Rollen-/Sichtbarkeitsregeln erzwingen: Mitglied nur eigene Daten + freie-Plätze-Zahl; Trainer nur eigene Kurse; kein Cross-Member-/Cross-Trainer-Zugriff. (Rollen/Datenschutz)
- Unveränderbarer Buchungs-Zeitstempel als Nachweis. (NFR)
