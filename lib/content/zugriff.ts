// FZ-011 — Content-Zugriff nach Tarif (BR7). On-Demand-Videos sind erst ab einem
// Mindesttarif sichtbar; Basic hat keinen On-Demand-Zugriff.
// Konzept: docs/concepts/FZ-011-content-zugriff.md

export type TarifName = "Basic" | "Plus" | "Premium";
// Mindesttarif eines Videos ist immer Plus oder Premium (spec §2 OnDemandVideo).
export type VideoMindestTarif = "Plus" | "Premium";

// Ordinale Tarifstufe für die Zugriffsschwelle (mitglied.tarif >= video.mindest_tarif).
export const TARIF_RANG: Record<TarifName, number> = { Basic: 0, Plus: 1, Premium: 2 };

// Reicht der Tarif für ein Video mit gegebenem Mindesttarif? (BR7)
export function darfVideoSehen(tarif: TarifName, mindestTarif: VideoMindestTarif): boolean {
  return TARIF_RANG[tarif] >= TARIF_RANG[mindestTarif];
}

// Welche Video-Mindesttarife darf dieser Tarif sehen? Für den Query-Filter der Videoliste.
// Basic → [] (kein On-Demand), Plus → ["Plus"], Premium → ["Plus","Premium"].
export function erlaubteVideoTarife(tarif: TarifName): VideoMindestTarif[] {
  return (["Plus", "Premium"] as const).filter((m) => darfVideoSehen(tarif, m));
}
