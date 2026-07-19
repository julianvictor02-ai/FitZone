// FZ-027 — Gemeinsame Formularfelder für Anlegen und Bearbeiten eines On-Demand-Videos.
// Rein präsentational (Server-Actions validieren server-seitig in ./actions).

export type Kurstyp = { kurstypId: string; name: string };

export type VideoDaten = {
  titel: string;
  kurstypId: string | null;
  level: string | null;
  dauerMinuten: number | null;
  mindestTarif: string;
  url: string | null;
};

export function VideoFelder({ kurstypen, video }: { kurstypen: Kurstyp[]; video?: VideoDaten }) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-muted">
        YouTube-Link
        <input
          name="youtubeLink"
          defaultValue={video?.url ?? ""}
          required
          placeholder="https://www.youtube.com/watch?v=…"
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Titel
        <input name="titel" defaultValue={video?.titel ?? ""} required className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Kurstyp
        <select name="kurstypId" defaultValue={video?.kurstypId ?? ""} required className="input">
          <option value="" disabled>
            Bitte wählen
          </option>
          {kurstypen.map((k) => (
            <option key={k.kurstypId} value={k.kurstypId}>
              {k.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Mindest-Tarif
        <select name="mindestTarif" defaultValue={video?.mindestTarif ?? "Plus"} className="input">
          <option value="Plus">Plus</option>
          <option value="Premium">Premium</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Level (optional)
        <select name="level" defaultValue={video?.level ?? ""} className="input">
          <option value="">—</option>
          <option value="Anfaenger">Anfänger</option>
          <option value="Mittel">Mittel</option>
          <option value="Fortgeschritten">Fortgeschritten</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Dauer in Minuten (optional)
        <input
          type="number"
          name="dauerMinuten"
          min="1"
          defaultValue={video?.dauerMinuten ?? ""}
          className="input"
        />
      </label>
    </>
  );
}
