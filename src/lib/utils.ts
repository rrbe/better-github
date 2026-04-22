export function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return n === 1 ? singular : plural;
}
