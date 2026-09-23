export class DrivingUi {
  focused = false;
  constructor(private button: HTMLButtonElement) {
    button.addEventListener('click', () => this.setFocused(!this.focused));
    this.setFocused(false);
  }
  beginOperation() { this.setFocused(true); }
  setFocused(value: boolean) {
    this.focused = value;
    document.body.dataset.driving = String(value);
    this.button.textContent = value ? '显示面板' : '专注驾驶';
    this.button.setAttribute('aria-pressed', String(value));
    document.querySelectorAll<HTMLElement>('header, .intro, .model-card, footer, .scene-caption').forEach(el => { el.inert = value; });
  }
}

export class CockpitLook {
  yaw = 0;
  pitch = 0;
  private last: { x: number; y: number } | null = null;
  private touchId: number | null = null;
  constructor(private canvas: HTMLCanvasElement, private enabled: () => boolean) {
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' && this.canLook(e) && this.touchId === null) {
        this.touchId = e.pointerId;
        this.last = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.canLook(e) || (e.pointerType !== 'mouse' && e.pointerId !== this.touchId)) { this.last = null; return; }
      if (this.last) {
        this.yaw = Math.max(-1.25, Math.min(1.25, this.yaw - (e.clientX - this.last.x) * .004));
        this.pitch = Math.max(-.65, Math.min(.5, this.pitch - (e.clientY - this.last.y) * .003));
      }
      this.last = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerleave', () => { if (this.touchId === null) this.last = null; });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(event, e => { if ((e as PointerEvent).pointerId === this.touchId) this.resetPointer(); });
    }
    canvas.addEventListener('dblclick', () => { if (this.enabled()) this.reset(); });
    document.addEventListener('pointermove', e => {
      if (e.target !== canvas || !this.canLook(e)) this.last = null;
    });
    window.addEventListener('blur', () => this.resetPointer());
    document.addEventListener('visibilitychange', () => this.resetPointer());
    new MutationObserver(() => this.resetPointer()).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  }
  private canLook(e: PointerEvent) {
    if (!this.enabled() || document.querySelector('dialog[open]')) return false;
    return !Array.from(document.querySelectorAll<HTMLElement>('header, .intro, .model-card, .views, .mirror-strip, .right-tools, .drive-console, footer, .scene-caption, #expanded-wrap, #exam-overlay, #exam-hud')).some(el => {
      const style = getComputedStyle(el);
      if (el.hidden || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    });
  }
  resetPointer() { this.last = null; this.touchId = null; }
  reset() { this.yaw = this.pitch = 0; this.resetPointer(); }
}
