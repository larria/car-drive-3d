import type { Gear } from './physics';

export interface AudioSettings {
  audioEnabled: boolean;
  masterVolume: number;
  musicVolume: number;
  vehicleVolume: number;
  cuesVolume: number;
}
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  audioEnabled: true, masterVolume: 0.7, musicVolume: 0.35, vehicleVolume: 0.65, cuesVolume: 0.8,
};
export const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
export type AudioScene = 'menu' | 'briefing' | 'practice' | 'exam' | 'paused' | 'result';
export interface VehicleAudioInput { speed: number; gear: Gear; throttle: number; brake: number; inside: boolean }
/** Virtual engine frequency, not measured RPM. Reverse uses the same absolute m/s mapping. */
export function vehicleAudioModel(input: VehicleAudioInput) {
  const speed = Number.isFinite(input.speed) ? Math.min(60, Math.abs(input.speed)) : 0;
  const load = unit(input.throttle);
  return {
    frequency: 34 + (input.gear === 'N' ? load * 58 : Math.min(speed, 18) * 4 + load * 28),
    engine: 0.045 + load * 0.035,
    mechanical: 0.012 + load * 0.015,
    rolling: Math.min(0.07, speed * 0.004),
    wind: Math.min(0.035, Math.max(0, speed - 3) * 0.002),
    brake: speed > 0.2 ? unit(input.brake) * Math.min(speed, 4) * 0.003 : 0,
    cutoff: input.inside ? 900 : 3800,
  };
}
export type AudioEventType = 'ui-confirm' | 'ui-back' | 'ui-reject' | 'startup' | 'gear' | 'parking' | 'warning' | 'penalty' | 'pass' | 'fail' | 'complete';
export interface AudioEvent { type: AudioEventType; key?: string }
export const EVENT_PRIORITY: Record<AudioEventType, number> = {
  complete: 5, pass: 5, fail: 5, warning: 4, penalty: 4, parking: 3, startup: 2, gear: 2,
  'ui-confirm': 1, 'ui-back': 1, 'ui-reject': 1,
};
export function gearAudioEvent(oldGear: Gear, newGear: Gear): AudioEvent | undefined {
  return oldGear === newGear ? undefined : { type: 'gear' };
}
/** A presentation-only run-local deduplicator. Never changes scoring or parking state. */
export class AudioEventQueue {
  private seen = new Set<string>();
  private last = new Map<AudioEventType, number>();
  clear() { this.seen.clear(); this.last.clear(); }
  select(events: readonly AudioEvent[], now: number): AudioEvent[] {
    const sorted = [...events].sort((a, b) => EVENT_PRIORITY[b.type] - EVENT_PRIORITY[a.type]);
    const accepted: AudioEvent[] = [];
    // Mark every keyed event consumed, including suppressed terminal-frame events.
    for (const event of sorted) {
      const key = event.key === undefined ? undefined : `${event.type}:${event.key}`;
      if (key && this.seen.has(key)) continue;
      if (key) this.seen.add(key);
      if (accepted.length >= 3 || accepted.some(item => EVENT_PRIORITY[item.type] === 5)) continue;
      const cooldown = event.type === 'ui-reject' ? 650 : event.type === 'gear' ? 180 : 300;
      if (now - (this.last.get(event.type) ?? -Infinity) < cooldown) continue;
      this.last.set(event.type, now);
      accepted.push(event);
    }
    return accepted;
  }
}
