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
  private pendingLock = false;
  private ignoreNextEscape = false;
  private wasLocked = false;
  private unlockingProgrammatically = false;
  constructor(private canvas: HTMLCanvasElement, private enabled: () => boolean,
    private lockButton: HTMLButtonElement, private feedback: (message: string) => void) {
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' && this.canLook(e) && this.touchId === null) {
        this.touchId = e.pointerId;
        this.last = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (this.locked) {
        if (e.pointerType === 'mouse' && this.enabled()) this.rotate(e.movementX, e.movementY);
        return;
      }
      if (!this.canLook(e)) {
        if (e.pointerType === 'mouse') this.last = null;
        return;
      }
      if (e.pointerType !== 'mouse' && e.pointerId !== this.touchId) return;
      if (this.last) this.rotate(e.clientX - this.last.x, e.clientY - this.last.y);
      this.last = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerleave', () => { if (this.touchId === null && !this.locked) this.last = null; });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(event, e => {
        if ((e as PointerEvent).pointerId === this.touchId) this.resetPointer();
      });
    }
    canvas.addEventListener('dblclick', () => { if (this.enabled()) this.reset(); });
    document.addEventListener('pointermove', e => {
      if (!this.locked && e.pointerType === 'mouse' && (e.target !== canvas || !this.canLook(e))) this.last = null;
    });
    document.addEventListener('pointerlockchange', () => {
      const locked = this.locked;
      if (!locked && this.wasLocked && !this.unlockingProgrammatically) this.ignoreNextEscape = true;
      this.unlockingProgrammatically = false;
      this.wasLocked = locked;
      this.pendingLock = false;
      this.resetPointer();
      this.lockButton.setAttribute('aria-pressed', String(locked));
      this.lockButton.textContent = locked ? '退出环视' : '锁定环视';
      document.body.dataset.lookLocked = String(locked);
      if (locked) this.feedback('已锁定环视 · Esc 解锁，第二次 Esc 暂停');
    });
    document.addEventListener('pointerlockerror', () => {
      this.pendingLock = false;
      this.feedback('浏览器未允许锁定环视，仍可移动鼠标转头');
    });
    window.addEventListener('blur', () => this.unlock());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.unlock(); });
  }
  get locked() { return document.pointerLockElement === this.canvas; }
  private rotate(dx: number, dy: number) {
    this.yaw = Math.max(-Math.PI, Math.min(Math.PI, this.yaw - dx * .004));
    this.pitch = Math.max(-.65, Math.min(.5, this.pitch - dy * .003));
  }
  async lock() {
    if (!this.enabled() || this.pendingLock) return;
    if (this.locked) { this.unlock(); return; }
    if (!this.canvas.requestPointerLock) { this.feedback('当前浏览器不支持锁定环视，仍可移动鼠标转头'); return; }
    this.pendingLock = true;
    this.ignoreNextEscape = false;
    try {
      await this.canvas.requestPointerLock();
      if (!this.locked) this.pendingLock = false;
    } catch {
      this.pendingLock = false;
      this.feedback('浏览器未允许锁定环视，仍可移动鼠标转头');
    }
  }
  unlock() {
    this.pendingLock = false;
    this.ignoreNextEscape = false;
    this.resetPointer();
    if (this.locked) { this.unlockingProgrammatically = true; document.exitPointerLock(); }
  }
  /** Browser may unlock before dispatching Escape's keydown. */
  consumeEscape() {
    if (this.locked || this.pendingLock) {
      this.unlock();
      return true;
    }
    if (this.ignoreNextEscape) { this.ignoreNextEscape = false; return true; }
    return false;
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
  resetPointer() {
    if (this.touchId !== null && this.canvas.hasPointerCapture(this.touchId)) this.canvas.releasePointerCapture(this.touchId);
    this.last = null; this.touchId = null;
  }
  reset() { this.yaw = this.pitch = 0; this.resetPointer(); }
}
