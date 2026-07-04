# Offene Fragen an Lisa (FitZone)

_Stand: 2026-07-04 · Quelle: `docs/spec.md §8`_

Hallo Lisa, die App ist so weit gebaut, dass alle Kernfunktionen laufen. An ein paar
Stellen mussten wir **sinnvolle Standardwerte annehmen**, damit es weitergeht. Bitte geh
die folgenden Punkte durch und sag jeweils nur: **„passt so"** oder **„bitte ändern auf …"**.

Jeder Punkt zeigt:
- **Frage** – was noch offen ist
- **Aktuell in der App** – was gerade eingestellt ist (unser Vorschlag)
- **Warum es zählt** – was sich ändert, wenn du es anders willst

Wichtig: Nichts davon blockiert den Betrieb. Änderungen sind später leicht umstellbar –
je früher wir sie kennen, desto weniger Nacharbeit.

---

## Schnellübersicht (zum Abhaken)

| # | Thema | Aktueller Standard | Deine Entscheidung |
|---|-------|--------------------|--------------------|
| 1 | Warteliste-Obergrenze | 5 pro Kurstermin | ☐ passt / ☐ ändern: ___ |
| 2 | Basic-Buchungslimit | 5 pro Kalendermonat | ☐ passt / ☐ ändern: ___ |
| 3 | Plus-Buchungslimit | kein festes Limit | ☐ passt / ☐ ändern: ___ |
| 4 | Darf Basic Livestreams buchen? | ja (nicht eingeschränkt) | ☐ ja / ☐ nein |
| 5 | Kurs-Kapazitäten je Kurstyp | pro Termin einzeln gesetzt | ☐ Liste liefern |
| 6 | Storno-/Buchungsfrist | 2 Stunden vor Start, für alle Kurse | ☐ passt / ☐ ändern: ___ |
| 7 | Stornogebühr-Höhe | nur Markierung, kein Betrag | ☐ passt / ☐ Betrag/Regel: ___ |
| 8 | No-Show-Schwelle | 3 No-Shows in 90 Tagen | ☐ passt / ☐ ändern: ___ |
| 9 | Early-Access für Premium | nicht eingebaut | ☐ weglassen / ☐ einbauen: ___ |
| 10 | Benachrichtigungskanal | noch keiner (nur intern) | ☐ E-Mail / ☐ Push / ☐ SMS |
| 11 | Tarifpreise | nicht hinterlegt | ☐ Preise liefern |
| 12 | Login-/Kontaktdaten | E-Mail-Login, Details offen | ☐ klären |

---

## 1. Wartelisten-Obergrenze
- **Frage:** Wie viele Leute dürfen maximal auf die Warteliste eines vollen Kurses? Gilt die
  Grenze pro einzelnem Termin oder pro Kursart?
- **Aktuell in der App:** **5 Wartende pro Kurstermin**, einheitlich für alle Tarife (Premium
  drängelt sich nicht vor).
- **Warum es zählt:** Bei zu niedriger Grenze gehen Interessenten leer aus; bei zu hoher wird
  die Liste unrealistisch lang. Der Wert ist eine reine Zahl und schnell änderbar.

## 2. Basic-Buchungslimit
- **Frage:** Basic = „5 Buchungen im Monat" – meinst du den **Kalendermonat** (1.–31.) oder
  **rollierend** (die letzten 30 Tage)? (Deine „6 Kurse in einer Woche"-Aussage haben wir als
  Beispiel verstanden, nicht als eigene Regel.)
- **Aktuell in der App:** Max. **5 Buchungen pro Kalendermonat**, gezählt nach Kurs-Datum. Eine
  Stornierung gibt den Platz im Monat wieder frei.
- **Warum es zählt:** Bestimmt, wann ein Basic-Mitglied „für diesen Monat voll" ist.

## 3. Plus-Buchungslimit
- **Frage:** Bestätigst du, dass **Plus kein festes monatliches Limit** hat (Steuerung nur über
  das No-Show-System)?
- **Aktuell in der App:** Plus und Premium haben **kein Zähllimit**.
- **Warum es zählt:** Falls Plus doch eine Obergrenze bekommen soll, müssen wir sie festlegen.

## 4. Dürfen Basic-Mitglieder Livestreams buchen?
- **Frage:** Basic ist „Studio-Fokus". Im Gespräch war klar: Basic sieht **keine On-Demand-Videos**.
  Unklar blieb: darf Basic **Livestream-Kurse** buchen?
- **Aktuell in der App:** Basic **kann** Livestreams aktuell buchen (wir schränken es nicht ein,
  um dein bestehendes Verhalten nicht ungefragt zu ändern). On-Demand-Videos sind für Basic
  gesperrt.
- **Warum es zählt:** Sagst du „nein", bauen wir eine klare Sperre ein (Basic = nur Studio).

## 5. Kurs-Kapazitäten je Kurstyp
- **Frage:** Welche **Standard-Platzzahlen** gelten je Kursart und Modus? Bisher fix: Yoga Studio
  12–15. Offen: die übrigen Typen (Pilates, Spinning, HIIT, Bodyworkout) und die Livestream-
  Kapazitäten (grob genannt: Yoga/Pilates ~15, HIIT ~20 – bitte mit Marie/Tom final festlegen).
- **Aktuell in der App:** Kapazität wird **pro einzelnem Termin** gesetzt; es gibt noch keine
  verbindlichen Standardwerte je Kurstyp.
- **Warum es zählt:** Mit Standardwerten müssen neue Termine nicht jedes Mal von Hand befüllt werden.

## 6. Storno- und Buchungsfrist
- **Frage:** Deine „gedachte Grenze" war 2 Stunden vor Kursbeginn. Sollen wir das **offiziell so
  festlegen** – und **einheitlich für alle Kurse** oder je Kursart unterschiedlich?
- **Aktuell in der App:** **2 Stunden vor Start**, einheitlich für alle Kurse. Wer später
  storniert, wird als „gebührenpflichtig" markiert (siehe #7).
- **Warum es zählt:** Bestimmt, ab wann eine Absage als „zu kurzfristig" gilt.

## 7. Höhe der Stornogebühr
- **Frage:** Du nanntest „50 % des Kurspreises". Bei Flat-Tarifen (Monatsbeitrag) ist unklar,
  was „Kurspreis" ist. Sollen wir überhaupt einen **Betrag** berechnen – und wenn ja, welchen?
- **Aktuell in der App:** Bei zu kurzfristiger Absage wird nur ein **Vermerk „Gebühr fällig"**
  gesetzt (Premium ist befreit). **Kein Betrag, keine automatische Abbuchung** – du wickelst das
  von Hand ab.
- **Warum es zählt:** Für eine automatische Berechnung/Abbuchung bräuchten wir eine klare
  Preis-Definition. Ohne die bleibt es beim manuellen Vermerk.

## 8. No-Show-Schwelle
- **Frage:** Ab wie vielen „nicht erschienen" soll das System dir einen Hinweis geben – und über
  welchen **Zeitraum**? (Du nanntest „3–4 Mal".)
- **Aktuell in der App:** Hinweis ab **3 No-Shows innerhalb der letzten 90 Tage**. **Keine
  automatische Sperre** – die Entscheidung bleibt immer bei dir (auch Premium bleibt buchbar).
- **Warum es zählt:** Zu niedrig = viele Fehlalarme; zu hoch = du siehst Probleme spät.

## 9. Early-Access-Buchungsfenster für Premium
- **Frage:** Sollen Premium-Mitglieder **früher buchen** dürfen als andere? Wenn ja: für welche
  Tarife und **wie viel früher** (z. B. 24 h)? Das war bisher nur eine Idee.
- **Aktuell in der App:** **Nicht eingebaut** – alle buchen zeitgleich; die Warteliste bleibt
  strikt „wer zuerst kommt".
- **Warum es zählt:** Ist ein echter Premium-Mehrwert, aber optional. Nur bei „ja" bauen wir es.

## 10. Benachrichtigungskanal
- **Frage:** Worüber sollen Mitglieder Bestätigungen, Nachrück-Angebote und Kursausfälle
  bekommen – **E-Mail, Push oder SMS**?
- **Aktuell in der App:** Die App **erzeugt** alle Benachrichtigungen bereits an den richtigen
  Stellen, verschickt sie aber noch **nicht nach außen** (nur intern protokolliert). Im Bereich
  „Mein Bereich" sieht das Mitglied Abgesagt/Verschoben direkt.
- **Warum es zählt:** Sobald du den Kanal wählst, schalten wir den echten Versand frei (E-Mail
  ist am schnellsten umsetzbar).

## 11. Tarifpreise
- **Frage:** Was kosten **Basic, Plus und Premium** im Monat? (Du meintest, das sei variabel.)
- **Aktuell in der App:** **Keine Preise hinterlegt** – wird für den Buchungsbetrieb nicht
  gebraucht, wäre aber für Abrechnung/Anzeige nötig.
- **Warum es zählt:** Nur relevant, wenn Preise in der App sichtbar oder für Gebühren gebraucht
  werden (siehe #7).

## 12. Login- und Kontaktdaten
- **Frage:** Wie sollen sich Mitglieder und Trainer **anmelden** (E-Mail + Passwort reicht?),
  und welche **Kontaktdaten** erfassen wir (E-Mail Pflicht, Telefon optional)?
- **Aktuell in der App:** Login per **E-Mail-Konto**; jedes Mitglied/Trainer braucht eine
  E-Mail. Passwort-Regeln und das Anlegen der ersten Zugänge sind noch festzulegen.
- **Warum es zählt:** Nötig, bevor echte Mitglieder/Trainer die App nutzen.

---

## Nächste Schritte
- **Am wichtigsten** (blockiert echten Betrieb): #10 Kanal, #12 Login. #4, #6, #8 legen Regeln fest.
- **Weniger dringend**: #7/#11 (Preise/Gebühren), #9 (Early-Access, optionaler Mehrwert), #5
  (Kapazitäten mit Marie/Tom).
- Deine Antworten pflegen wir direkt in `docs/spec.md` (Fakten) und `docs/decisions.md`
  (Entscheidungen) ein.
