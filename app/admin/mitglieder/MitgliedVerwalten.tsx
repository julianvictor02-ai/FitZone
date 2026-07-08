"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle } from "@/components/icons";
import { aktualisiereMitglied, loescheMitglied } from "./actions";

// FZ-006 — Mitglied bearbeiten (Lese- ↔ Bearbeiten-Modus) und Soft-Delete mit
// zweistufiger Bestätigung. Persistenz/Validierung server-seitig in ./actions.

type Tarif = { tarifId: string; name: string };
type Mitglied = {
  mitgliedId: string;
  name: string;
  email: string;
  status: "aktiv" | "pausiert" | "geloescht";
  tarifId: string;
  mitgliedschaftBis: string | null;
};

export function MitgliedVerwalten({
  mitglied,
  tarife,
  aktiviert,
}: {
  mitglied: Mitglied;
  tarife: Tarif[];
  aktiviert: boolean;
}) {
  const router = useRouter();
  const [bearbeiten, setBearbeiten] = useState(false);
  const [dialogOffen, setDialogOffen] = useState(false);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tarifName =
    tarife.find((t) => t.tarifId === mitglied.tarifId)?.name ?? "—";

  function zeigeToast(text: string, ok: boolean) {
    setToast({ text, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  function speichern(formData: FormData) {
    start(async () => {
      const r = await aktualisiereMitglied(formData);
      if (r.status === "ok") {
        setBearbeiten(false);
        zeigeToast("Änderungen gespeichert ✓", true);
        router.refresh();
      } else {
        zeigeToast(r.meldung, false);
      }
    });
  }

  function loeschen() {
    setDialogOffen(false);
    start(async () => {
      const r = await loescheMitglied(mitglied.mitgliedId);
      if (r.status === "ok") {
        zeigeToast(`${mitglied.name} gelöscht`, true);
        router.refresh();
      } else {
        zeigeToast(r.meldung, false);
      }
    });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-ink">{mitglied.name}</div>
          <div className="text-sm text-muted break-all">{mitglied.email}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`badge ${mitglied.status === "aktiv" ? "badge-success" : "badge-muted"}`}
          >
            {mitglied.status}
          </span>
          {!aktiviert && (
            <span className="badge badge-warn" title="Mitglied hat noch kein Passwort gesetzt">
              Konto nicht aktiviert
            </span>
          )}
        </div>
      </div>

      {!bearbeiten ? (
        /* Leseansicht */
        <div className="mt-3 flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">Tarif</dt>
            <dd className="text-ink text-right">{tarifName}</dd>
            <dt className="text-muted">Mitgliedschaft bis</dt>
            <dd className="text-ink text-right">{mitglied.mitgliedschaftBis ?? "—"}</dd>
          </dl>
          <div className="flex gap-2">
            <button
              onClick={() => setBearbeiten(true)}
              disabled={pending}
              className="btn btn-outline btn-block"
            >
              Bearbeiten
            </button>
            <button
              onClick={() => setDialogOffen(true)}
              disabled={pending}
              className="btn btn-danger btn-block"
            >
              Löschen
            </button>
          </div>
        </div>
      ) : (
        /* Bearbeiten-Modus */
        <form action={speichern} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="mitgliedId" value={mitglied.mitgliedId} />
          <label className="flex flex-col gap-1 text-sm text-muted">
            Name
            <input name="name" defaultValue={mitglied.name} required className="input" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Tarif
            <select name="tarifId" defaultValue={mitglied.tarifId} required className="input">
              {tarife.map((t) => (
                <option key={t.tarifId} value={t.tarifId}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Status
            <select name="status" defaultValue={mitglied.status} className="input">
              <option value="aktiv">aktiv</option>
              <option value="pausiert">pausiert</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Mitgliedschaft bis
            <input
              type="date"
              name="mitgliedschaftBis"
              defaultValue={mitglied.mitgliedschaftBis ?? ""}
              className="input"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBearbeiten(false)}
              disabled={pending}
              className="btn btn-outline btn-block"
            >
              Abbrechen
            </button>
            <button type="submit" disabled={pending} className="btn btn-primary btn-block">
              {pending ? <span className="spinner" /> : "Speichern"}
            </button>
          </div>
        </form>
      )}

      {/* Löschen-Bestätigung (zweistufig) */}
      {dialogOffen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Mitglied löschen"
          onClick={() => setDialogOffen(false)}
        >
          <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-ink leading-tight">Sicher löschen?</h3>
            <p className="mt-2 text-sm text-muted">
              Diese Aktion entfernt <strong className="text-ink">{mitglied.name}</strong> aus der
              aktiven Mitgliederliste. Eine Anmeldung ist danach nicht mehr möglich. Bestehende
              Buchungen und Historie bleiben als Nachweis erhalten.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDialogOffen(false)}
                className="btn btn-outline btn-block"
              >
                Abbrechen
              </button>
              <button onClick={loeschen} className="btn btn-danger btn-block">
                Bestätigen
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
    </>
  );
}
