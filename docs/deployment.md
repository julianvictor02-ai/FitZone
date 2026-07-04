# deployment.md — FitZone auf Vercel + iPhone

FitZone ist eine **Web-App** (Next.js). „Aufs iPhone laden" heißt: einmal auf Vercel
veröffentlichen, dann in Safari **zum Home-Bildschirm hinzufügen** (PWA — kein App Store).

---

## 1. Auf Vercel veröffentlichen

**Voraussetzungen:** GitHub-Repo `julianvictor02-ai/FitZone` (vorhanden), Supabase-Projekt
(vorhanden), ein Vercel-Konto.

1. Vercel → **Add New… → Project** → GitHub-Repo `FitZone` importieren.
2. Framework wird als **Next.js** erkannt, Root = Repo-Wurzel, Build/Install Standard.
3. **Environment Variables** setzen (Production + Preview):

   | Variable | Wert |
   |----------|------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ebd. (anon public) |
   | `DATABASE_URL` | Supabase → Database → **Transaction Pooler** (Port 6543) |
   | `CRON_SECRET` | beliebiges langes Secret (für den Warteliste-Cron) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web-Push (s. u.) |
   | `VAPID_PRIVATE_KEY` | Web-Push (s. u.) |
   | `VAPID_SUBJECT` | z. B. `mailto:info@fitzone.example` |

4. **Deploy** → Ergebnis-URL `https://<projekt>.vercel.app`.

### Datenbank-Migrationen
Nutzt du dieselbe Supabase-DB wie in der Entwicklung, sind alle Migrationen (`0000`–`0004`)
bereits angewandt — nichts zu tun. Für eine **frische** DB einmalig lokal mit gesetztem
`DATABASE_URL`: `npm run db:migrate`.

### Warteliste-Cron
`vercel.json` plant `GET /api/cron/warteliste` **täglich** (`0 3 * * *`). Vercel sendet dabei
automatisch `Authorization: Bearer <CRON_SECRET>` (die Route prüft genau das).
- **Hobby-Plan erlaubt nur tägliche Crons** — deshalb 1×/Tag statt häufiger (`*/10` schlägt
  beim Deploy fehl). Das betrifft ausschließlich **zeitgesteuerte Ablauf-Nachrückungen**
  (30-Min-Fenster): abgelaufene Angebote werden erst beim nächsten Lauf freigegeben. Frei
  werdende Plätze durch **Storno** rücken weiterhin **sofort** nach (Live-Trigger).
- Für echtes 30-Min-Verhalten: **Pro-Plan** (dann z. B. `*/10 * * * *`) oder ein **externer
  Cron**, der die URL alle paar Minuten mit dem Bearer-Secret aufruft.

---

## 2. Web-Push aktivieren (VAPID-Keys)

Einmalig ein Schlüsselpaar erzeugen (lokal, mit installiertem `web-push`):

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

`publicKey` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `privateKey` → `VAPID_PRIVATE_KEY` (in Vercel
und in der lokalen `.env.local`). Ohne diese Keys werden Benachrichtigungen nur geloggt
(kein Versand) — die App funktioniert trotzdem.

---

## 3. Aufs iPhone „installieren" (PWA)

1. **Safari** auf dem iPhone öffnen → die Vercel-URL aufrufen und anmelden.
2. **Teilen-Symbol** (Quadrat mit Pfeil) → **„Zum Home-Bildschirm"** → Hinzufügen.
3. Das **FitZone-Icon** liegt jetzt auf dem Home-Bildschirm; von dort startet die App
   eigenständig (Vollbild, ohne Safari-Leiste).
4. Für Push: **von der installierten App** in **„Mein Bereich" → Benachrichtigungen →
   Aktivieren** und die Berechtigung erlauben.

> **iOS-Hinweise:** Web-Push gibt es erst ab **iOS 16.4** und **nur** aus der zum
> Home-Bildschirm hinzugefügten App (nicht im normalen Safari-Tab). HTTPS ist Pflicht —
> über Vercel automatisch gegeben.

---

## 4. Noch offen für echten Betrieb

- **Login-Konten:** echte Mitglieder/Trainer brauchen ein Supabase-Auth-Konto, verknüpft
  über die `benutzer`-Tabelle (`scripts/bootstrap.ts` als Vorlage). Bis dahin ist nur der
  Admin/Testzugang nutzbar (siehe `decisions.md` FZ-006).
- **Kurspreise** in *Admin → Kurspreise* pflegen, damit Stornogebühren einen Betrag zeigen (FZ-016).
