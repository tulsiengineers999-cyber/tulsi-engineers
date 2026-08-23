/** Indian financial year label (1 April – 31 March), e.g. "2026-27". */
export function fiscalYearLabel(date = new Date()): string {
  const y = date.getFullYear();
  const start = date.getMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
