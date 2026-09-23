import { describe, expect, it } from 'vitest';
import * as CANNON from 'cannon-es';
import { DrivingPhysics, type DrivingInput } from '../src/physics';

const idle = { throttle: 0, brake: 0, steer: 0 };
function run(car: DrivingPhysics, frames: number, input: DrivingInput = idle) {
  for (let i = 0; i < frames; i++) car.update(1 / 60, input);
}

describe('DrivingPhysics real fixed-step simulation', () => {
  it('has the required axes, geometry and real supporting suspension', () => {
    const car = new DrivingPhysics();
    expect(car.world).toBeInstanceOf(CANNON.World);
    expect(car.vehicle).toBeInstanceOf(CANNON.RaycastVehicle);
    expect(car.chassis.position.y).toBe(0.65);
    expect(car.vehicle.wheelInfos.map(w => w.chassisConnectionPointLocal.toArray()))
      .toEqual([[-0.84, -0.29, -1.155], [0.83, -0.29, -1.155],
        [-0.82, -0.29, 1.495], [0.82, -0.29, 1.495]]);
    run(car, 180);
    expect(car.vehicle.numWheelsOnGround).toBe(4);
    expect(car.chassis.position.y).toBeGreaterThan(0.6);
    expect(car.chassis.position.y).toBeLessThan(0.8);
    expect(car.vehicle.wheelInfos.every(w => w.suspensionForce > 0)).toBe(true);
    expect(Math.abs(car.speed)).toBeLessThan(0.01);
  });

  it('D drives toward -Z and reports positive m/s; R reverses both', () => {
    for (const gear of ['D', 'R'] as const) {
      const car = new DrivingPhysics();
      expect(car.setGear(gear)).toBe(true);
      run(car, 240, { ...idle, throttle: 1 });
      const sign = gear === 'D' ? 1 : -1;
      expect(car.speed * sign).toBeGreaterThan(2);
      expect(car.chassis.position.z * sign).toBeLessThan(-5);
    }
  });

  it('positive steering turns left, negative turns right', () => {
    for (const steer of [0.5, -0.5]) {
      const car = new DrivingPhysics();
      run(car, 180, { throttle: 0.6, brake: 0, steer });
      expect(car.steering * steer).toBeGreaterThan(0);
      expect(car.chassis.position.x * steer).toBeLessThan(-0.5);
      const forward = car.chassis.quaternion.vmult(new CANNON.Vec3(0, 0, -1));
      expect(forward.x * steer).toBeLessThan(-0.1);
    }
  });

  it('brakes to a stable stop in both directions, even with throttle held', () => {
    for (const gear of ['D', 'R'] as const) {
      const car = new DrivingPhysics();
      car.setGear(gear);
      run(car, 180, { ...idle, throttle: 1 });
      run(car, 180, { ...idle, throttle: 1, brake: 1 });
      expect(Math.abs(car.speed)).toBeLessThan(0.05);
      const z = car.chassis.position.z;
      run(car, 120, { ...idle, brake: 1 });
      expect(Math.abs(car.chassis.position.z - z)).toBeLessThan(0.05);
    }
  });

  it('blocks moving direction changes, including a neutral bypass', () => {
    const car = new DrivingPhysics();
    run(car, 120, { ...idle, throttle: 1 });
    expect(car.setGear('R')).toBe(false);
    expect(car.gear).toBe('D');
    expect(car.setGear('N')).toBe(true);
    expect(car.setGear('R')).toBe(false);
    run(car, 180, { ...idle, brake: 1 });
    expect(car.setGear('R')).toBe(true);
    run(car, 120, { ...idle, throttle: 1 });
    expect(car.setGear('D')).toBe(false);
  });

  it('neutral has no engine force and full throttle levels near 45 km/h', () => {
    const car = new DrivingPhysics();
    car.setGear('N');
    run(car, 180, { ...idle, throttle: 1 });
    expect(Math.abs(car.speed)).toBeLessThan(0.01);
    car.setGear('D');
    run(car, 1800, { ...idle, throttle: 1 });
    expect(car.speed * 3.6).toBeGreaterThan(40);
    expect(car.speed * 3.6).toBeLessThan(46);
  });

  it('collides with boundary boxes instead of passing through', () => {
    const car = new DrivingPhysics();
    car.addBox(0, 1, -8, 30, 2, 0.5);
    run(car, 300, { ...idle, throttle: 1 });
    expect(car.chassis.position.z).toBeGreaterThan(-6.1);
    expect(Math.abs(car.speed)).toBeLessThan(0.2);
    expect(() => car.addBox(0, 0, 0, -1, 1, 1)).toThrow(RangeError);
  });

  it('reset restores pose, control and suspension state while retaining walls', () => {
    const car = new DrivingPhysics();
    car.addBox(20, 1, 0, 1, 2, 40);
    run(car, 180, { throttle: 1, brake: 0, steer: 0.4 });
    car.reset();
    expect(car.chassis.position.toArray()).toEqual([0, 0.65, 0]);
    expect(car.chassis.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    expect(car.chassis.velocity.length()).toBe(0);
    expect(car.chassis.angularVelocity.length()).toBe(0);
    expect([car.speed, car.steering, car.throttle, car.brake]).toEqual([0, 0, 0, 0]);
    expect(car.gear).toBe('D');
    expect(car.world.bodies).toHaveLength(3);
    run(car, 180, { ...idle, throttle: 1 });
    expect(car.chassis.position.z).toBeLessThan(-5);
    expect(Math.abs(car.chassis.position.x)).toBeLessThan(0.05);
  });

  it('caps elapsed time, clamps inputs and tolerates invalid numbers', () => {
    const a = new DrivingPhysics();
    const b = new DrivingPhysics();
    a.update(10, { throttle: 2, brake: -1, steer: 5 });
    b.update(0.05, { throttle: 1, brake: 0, steer: 1 });
    expect(a.chassis.position.toArray()).toEqual(b.chassis.position.toArray());
    expect(a.throttle).toBe(1);
    expect(a.brake).toBe(0);
    a.update(NaN, { throttle: NaN, brake: Infinity, steer: NaN });
    expect(Number.isFinite(a.speed)).toBe(true);
    expect(a.throttle).toBe(0);
    expect(a.steering).toBe(0);
  });
});
