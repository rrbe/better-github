export function getPRNumber(row: Element): number | null {
  const match = /^issue_(\d+)$/.exec(row.id);
  return match ? Number(match[1]) : null;
}

export function collectPRRows(): Map<number, Element> {
  const rows = new Map<number, Element>();
  for (const row of document.querySelectorAll("[id^='issue_']:not([id$='_link'])")) {
    const number = getPRNumber(row);
    if (number !== null) rows.set(number, row);
  }
  return rows;
}
