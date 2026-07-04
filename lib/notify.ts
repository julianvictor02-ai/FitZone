// Benachrichtigungs-Stub. Der Kanal (Push/E-Mail/SMS) ist laut spec.md §8 noch
// offen (BR2 Nachrücken, BR8 Kursausfall). Bis zur Entscheidung wird nur geloggt;
// die Aufrufstellen bleiben stabil und werden später auf Resend o. Ä. umgestellt.
export type BenachrichtigungTyp =
  | "nachrueck_angebot"
  | "buchung_bestaetigt"
  | "kurs_abgesagt"
  | "kurs_verschoben";

export async function benachrichtige(
  typ: BenachrichtigungTyp,
  mitgliedId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  console.log(`[benachrichtige] ${typ} → mitglied=${mitgliedId}`, details);
}
