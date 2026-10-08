import type { DrivingInput, Gear } from './physics';

/** Hysteresis below the physics gear lockout (0.5 m/s); require genuine standstill. */
export const AUTO_STOP_SPEED = 0.12;
export type ControlState = { gear: Gear; speed: number };
export type ControlIntent = { forward: boolean; reverse: boolean; brake: boolean; touchThrottle: boolean; steer: number };
export type ControlOutput = { input: DrivingInput; switching: boolean; rejected: boolean };

export class DrivingControls {
  private neutralLock = false;
  private mustReleaseNeutral = false;
  release() { this.neutralLock = false; this.mustReleaseNeutral = false; }
  /** Manual selection wins; neutral remains neutral until a new directional press. */
  manual(gear: Gear) { this.neutralLock = gear === 'N'; this.mustReleaseNeutral = this.neutralLock; }
  resolve(intent: ControlIntent, state: ControlState, realistic: boolean, changeGear: (gear: Gear) => boolean): ControlOutput {
    const input: DrivingInput = { throttle: 0, brake: 0, steer: intent.steer };
    const both = intent.forward && intent.reverse;
    if (realistic) {
      input.throttle = intent.forward || intent.touchThrottle ? 1 : 0;
      input.brake = intent.brake || intent.reverse ? 1 : 0;
      return { input, switching: false, rejected: false };
    }
    if (intent.brake || both) {
      input.brake = 1;
      return { input, switching: false, rejected: false };
    }
    const desired = intent.forward ? 'D' : intent.reverse ? 'R' : null;
    if (!desired) {
      if (this.neutralLock) this.mustReleaseNeutral = false;
      input.throttle = intent.touchThrottle ? 1 : 0;
      return { input, switching: false, rejected: false };
    }
    if (state.gear === desired) {
      this.neutralLock = false;
      this.mustReleaseNeutral = false;
      input.throttle = 1;
      return { input, switching: false, rejected: false };
    }
    // Manual neutral is respected; release the direction key before requesting motion.
    if (state.gear === 'N' && this.neutralLock && this.mustReleaseNeutral) {
      input.brake = 1;
      return { input, switching: true, rejected: false };
    }
    if (Math.abs(state.speed) >= AUTO_STOP_SPEED) {
      input.brake = 1;
      return { input, switching: true, rejected: false };
    }
    if (!changeGear(desired)) {
      input.brake = 1;
      return { input, switching: true, rejected: true };
    }
    this.neutralLock = false;
    this.mustReleaseNeutral = false;
    input.throttle = 1;
    return { input, switching: false, rejected: false };
  }
}
