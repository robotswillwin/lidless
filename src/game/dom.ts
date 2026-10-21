// Small helpers for the HUD's pieces: an element, a button that does something and keeps its tap to itself.

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement | null, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.append(e);
  return e;
}

export function button(cls: string, label: string, parent: HTMLElement, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, parent);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}
