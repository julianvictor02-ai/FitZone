import { CheckCircle, XCircle } from "@/components/icons";

export type BaumStatus = "idle" | "pending" | "ok" | "fehler";

// CSS-3D-Baum als visuelles Feedback zur Passworteingabe.
// „3D" ohne Library: perspective + rotateX-Neigung, kugelige Baumkronen aus radialen
// Gradienten (Licht oben-links, Schatten unten-rechts), Inset-Schatten für Volumen,
// Bodenschatten für Tiefe. Zustände recolorieren die Krone (grün/rot) + Glow-Puls.
// Ergebnis wird zusätzlich als Text + Icon ausgegeben (nicht nur Farbe → Farbfehlsicht).
export function Baum({ status, pulseKey }: { status: BaumStatus; pulseKey: number }) {
  return (
    <div className="baum-buehne">
      <div className={`baum baum-${status}`} key={pulseKey} aria-hidden="true">
        <span className="baum-glow" />
        <span className="baum-krone baum-krone-2" />
        <span className="baum-krone baum-krone-3" />
        <span className="baum-krone baum-krone-1" />
        <span className="baum-stamm" />
        <span className="baum-boden" />
      </div>
      <p className="baum-status" role="status" aria-live="polite">
        {status === "fehler" && (
          <span className="baum-txt baum-txt-fehler">
            <XCircle /> Falsch
          </span>
        )}
        {status === "ok" && (
          <span className="baum-txt baum-txt-ok">
            <CheckCircle /> Danke
          </span>
        )}
      </p>
    </div>
  );
}
