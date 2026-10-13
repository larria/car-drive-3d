/** Small, non-blocking status indicator shared by asynchronous controls. */
export function createBusy(text: string): HTMLSpanElement {
  const status = document.createElement('span');
  status.className = 'busy-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-busy', 'true');
  const ring = document.createElement('span');
  ring.className = 'busy-ring';
  ring.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = text;
  status.append(ring, label);
  return status;
}
