export function createNavCounter(
  nativeCounterTemplate: HTMLElement | undefined,
  count: number,
): HTMLElement {
  if (nativeCounterTemplate) {
    const counter = nativeCounterTemplate.cloneNode(true) as HTMLElement;
    const label = counter.querySelector<HTMLElement>('[data-component="CounterLabel"]');
    if (label) label.textContent = String(count);

    const hiddenLabel = counter.querySelector<HTMLElement>('[class*="VisuallyHidden"]');
    if (hiddenLabel) hiddenLabel.textContent = `\u00a0(${count})`;
    return counter;
  }

  const counter = document.createElement("span");
  counter.dataset.component = "counter";

  const label = document.createElement("span");
  label.className = "Counter";
  label.dataset.component = "CounterLabel";
  label.dataset.variant = "secondary";
  label.ariaHidden = "true";
  label.textContent = String(count);

  const hiddenLabel = document.createElement("span");
  hiddenLabel.className = "sr-only";
  hiddenLabel.textContent = `\u00a0(${count})`;

  counter.append(label, hiddenLabel);
  return counter;
}
