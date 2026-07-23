"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bucheKursterminAction,
  warteAction,
  bestaetigeNachrueckungAction,
  storniereBuchungAction,
} from "./actions";
import { FristCountdown } from "@/components/FristCountdown";
import { Check, CheckCircle, Hourglass, Ban, XCircle, Info } from "@/components/icons";

export type Zustand =
  | "buchbar"
  | "voll"
  | "warteliste_voll"
  | "gebucht"
  | "wartend"
  | "benachrichtigt"
  | "livestream_gesperrt";

const MELDUNG: Record<string, string> = {
  bestaetigt: "Gebucht ✓",
  voll: "Ausgebucht",
  bereits_gebucht: "Bereits gebucht",
  limit_erreicht: "Buchungskontingent erschöpft (Basic: 5/Monat)",
  kurs_nicht_buchbar: "Nicht buchbar",
  nicht_angemeldet: "Bitte anmelden",
  kein_mitglied: "Kein Mitglied-Profil",
  wartend: "Auf Warteliste ✓",
  platz_frei: "Platz frei — bitte buchen",
  bereits_wartend: "Bereits auf Warteliste",
  warteliste_voll: "Warteliste voll",
  nachgerueckt: "Nachgerückt & gebucht ✓",
  abgelaufen: "Frist abgelaufen",
  kein_angebot: "Kein Nachrück-Angebot",
  livestream_gesperrt: "Livestreams nur ab Plus",
  mitglied_pausiert: "Mitgliedschaft pausiert — bitte an den Admin wenden",
};

const AKTUALISIEREN = new Set([
  "bestaetigt",
  "wartend",
  "nachgerueckt",
  "abgelaufen",
  "platz_frei",
]);

// Positive Ergebnisse → grüner Erfolgs-Toast + kurzer haptischer Impuls.
const ERFOLG = new Set(["bestaetigt", "wartend", "nachgerueckt", "storniert"]);

const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function KursterminAktion({
  kursterminId,
  zustand,
  position,
  fristBisISO,
  stornoGebuehrDroht,
  stornoBefreit,
  stornoFristUhrzeit,
  stornoGebuehrBetrag,
  buchenGesperrtGrund,
}: {
  kursterminId: string;
  zustand: Zustand;
  position?: number;
  fristBisISO?: string;
  stornoGebuehrDroht?: boolean;
  stornoBefreit?: boolean;
  stornoFristUhrzeit?: string;
  stornoGebuehrBetrag?: number | null;
  buchenGesperrtGrund?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [dialogOffen, setDialogOffen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function zeigeToast(text: string, ok: boolean) {
    setToast({ text, ok });
    if (ok && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(18); // dezenter Erfolgs-Impuls (Mobil)
    }
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  function run(action: () => Promise<{ status: string }>) {
    start(async () => {
      const r = await action();
      zeigeToast(MELDUNG[r.status] ?? r.status, ERFOLG.has(r.status));
      if (AKTUALISIEREN.has(r.status)) router.refresh();
    });
  }

  function fuehreStornoAus() {
    setDialogOffen(false);
    start(async () => {
      const r = await storniereBuchungAction(kursterminId);
      if (r.status === "storniert") {
        zeigeToast(
          r.gebuehrFaellig
            ? `Storniert — Gebühr fällig${r.betrag != null ? ` (${EUR.format(r.betrag)})` : ""}`
            : "Storniert ✓",
          true,
        );
        router.refresh();
      } else {
        zeigeToast(MELDUNG[r.status] ?? r.status, false);
      }
    });
  }

  // Bei drohender Gebühr erst den Bestätigungsdialog zeigen (Betrag/Bedingung),
  // sonst direkt stornieren (kostenlos, keine Konsequenz).
  function onStornoKlick() {
    if (stornoGebuehrDroht) setDialogOffen(true);
    else fuehreStornoAus();
  }

  const betragText = stornoGebuehrBetrag != null ? EUR.format(stornoGebuehrBetrag) : "eine Gebühr";

  return (
    <div className="flex flex-col gap-2">
      {zustand === "buchbar" &&
        (buchenGesperrtGrund ? (
          <>
            <button disabled title={buchenGesperrtGrund} className="btn btn-primary btn-block">
              <Check /> Buchen
            </button>
            <p className="hinweis">
              <Ban /> {buchenGesperrtGrund}.
            </p>
          </>
        ) : (
          <button
            onClick={() => run(() => bucheKursterminAction(kursterminId))}
            disabled={pending}
            className="btn btn-primary btn-block"
          >
            {pending ? <span className="spinner" /> : <><Check /> Buchen</>}
          </button>
        ))}

      {/* Voller Kurs: gleiche Stelle, aus „Buchen" wird „Auf Warteliste" (FIFO server-seitig). */}
      {zustand === "voll" && (
        <>
          <button
            onClick={() => run(() => warteAction(kursterminId))}
            disabled={pending}
            className="btn btn-primary btn-block"
          >
            {pending ? <span className="spinner" /> : <><Hourglass /> Auf Warteliste</>}
          </button>
          <p className="hinweis">Ausgebucht — du rückst per Warteliste (FIFO) nach.</p>
        </>
      )}

      {zustand === "benachrichtigt" && (
        <>
          <button
            onClick={() => run(() => bestaetigeNachrueckungAction(kursterminId))}
            disabled={pending}
            className="btn btn-primary btn-block"
          >
            {pending ? <span className="spinner" /> : <><Check /> Nachrücken bestätigen</>}
          </button>
          <p className="hinweis hinweis-ok">
            <CheckCircle /> Platz frei — bitte bestätigen
            {fristBisISO ? (
              <>
                {" "}(<FristCountdown bisISO={fristBisISO} />)
              </>
            ) : null}
            .
          </p>
        </>
      )}

      {zustand === "gebucht" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="badge badge-success pop">
              <CheckCircle /> Gebucht
            </span>
            <button onClick={onStornoKlick} disabled={pending} className="btn btn-outline">
              {pending ? <span className="spinner spinner-ink" /> : <><XCircle /> Stornieren</>}
            </button>
          </div>
          {/* Storno-Frist VOR der Aktion sichtbar machen (BR5). */}
          {stornoBefreit ? (
            <p className="hinweis">
              <Info /> Jederzeit kostenlos stornierbar (Premium).
            </p>
          ) : stornoGebuehrDroht ? (
            <p className="hinweis">
              <Ban /> Storno-Frist abgelaufen — Stornieren kostet jetzt {betragText}.
            </p>
          ) : (
            <p className="hinweis">
              <Info /> Kostenlos stornierbar bis {stornoFristUhrzeit} Uhr, danach {betragText}.
            </p>
          )}
        </>
      )}

      {zustand === "wartend" && (
        <>
          <span className="badge badge-warn">
            <Hourglass /> Warteliste · Platz {position}
          </span>
          <p className="hinweis">Du rückst automatisch nach, sobald ein Platz frei wird (FIFO).</p>
        </>
      )}

      {zustand === "warteliste_voll" && (
        <span className="badge badge-warn">
          <Ban /> Warteliste voll
        </span>
      )}

      {zustand === "livestream_gesperrt" && (
        <span className="badge badge-muted" title="Livestream-Kurse sind ab Tarif Plus buchbar">
          <Ban /> Nur ab Plus
        </span>
      )}

      {/* Bestätigungsdialog: nur bei drohender Storno-Gebühr (Konsequenz). */}
      {dialogOffen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Storno bestätigen"
          onClick={() => setDialogOffen(false)}
        >
          <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-ink leading-tight">Kostenpflichtig stornieren?</h3>
            <p className="mt-2 text-sm text-muted">
              Die kostenlose Storno-Frist (bis {stornoFristUhrzeit} Uhr) ist abgelaufen. Bei
              Storno wird <strong className="text-ink">{betragText}</strong> fällig (50 % des
              Kurspreises). Die Buchung wird endgültig storniert.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDialogOffen(false)}
                className="btn btn-outline btn-block"
              >
                Abbrechen
              </button>
              <button onClick={fuehreStornoAus} className="btn btn-danger btn-block">
                Kostenpflichtig stornieren
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.ok ? "toast-ok" : ""}`} role="status" aria-live="polite">
          {toast.ok ? <CheckCircle /> : <XCircle />}
          {toast.text}
        </div>
      )}
    </div>
  );
}
