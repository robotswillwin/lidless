// Short captions over the frame: what is not about a thing she can point at (a way not built yet, what the fixer's work
// does). What she finds is written at the thing (hud.ts), and conversations are said over heads (talk.ts).

export class UI {
  private caption: HTMLElement;
  private captionTimer = 0;

  constructor(stage: HTMLElement) {
    this.caption = document.createElement('p');
    this.caption.className = 'caption';
    this.caption.hidden = true;
    this.caption.setAttribute('aria-live', 'polite');
    stage.append(this.caption);
  }

  showCaption(text: string): void {
    this.caption.textContent = text;
    this.caption.hidden = false;
    window.clearTimeout(this.captionTimer);
    this.captionTimer = window.setTimeout(() => (this.caption.hidden = true), 3500 + text.length * 45);
  }

  hideCaption(): void {
    window.clearTimeout(this.captionTimer);
    this.caption.hidden = true;
  }
}
