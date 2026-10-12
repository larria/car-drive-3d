/** Existing model-matched simulation dimensions, not manufacturer specifications. */
export const VEHICLE = { length: 4.10, width: 1.72, wheelbase: 2.650, frontAxle: -1.155, rearAxle: 1.495, maxSpeed: 4.61, steeringLock: Math.PI / 4 } as const;
/** Shared model wheel geometry. Width is a simulation choice, not calibrated manufacturer data. */
export const WHEEL_RADIUS = .35, WHEEL_WIDTH = .22;
export const WHEEL_POSITIONS = [
  {x:-.84,y:-.29,z:VEHICLE.frontAxle}, {x:.83,y:-.29,z:VEHICLE.frontAxle},
  {x:-.82,y:-.29,z:VEHICLE.rearAxle}, {x:.82,y:-.29,z:VEHICLE.rearAxle},
] as const;
