import * as CANNON from 'cannon-es';

export type Gear = 'D' | 'N' | 'R';
export interface DrivingInput {
  throttle: number;
  brake: number;
  /** Normalized steering: +1 is left, -1 is right. */
  steer: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0;

/** Y-up vehicle with its nose along local -Z. Distances are metres. */
export class DrivingPhysics {
  readonly world: CANNON.World;
  readonly chassis: CANNON.Body;
  readonly vehicle: CANNON.RaycastVehicle;
  speed = 0;
  steering = 0;
  gear: Gear = 'D';
  throttle = 0;
  brake = 0;
  private readonly forward = new CANNON.Vec3();

  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.defaultContactMaterial.friction = 0.3;
    this.world.defaultContactMaterial.restitution = 0;
    (this.world.solver as CANNON.GSSolver).iterations = 15;

    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    ground.aabbNeedsUpdate = true;
    this.world.addBody(ground);
    this.chassis = new CANNON.Body({
      mass: 1200,
      shape: new CANNON.Box(new CANNON.Vec3(0.86, 0.25, 2.05)),
      position: new CANNON.Vec3(0, 0.65, 0),
      linearDamping: 0.08,
      angularDamping: 0.45,
      allowSleep: false,
    });
    // Keep yaw and real vertical suspension, but prevent rollover in training.
    this.chassis.angularFactor.set(0, 1, 0);
    // Also constrain impulse response (angularFactor only constrains integration).
    this.chassis.invInertia.x = 0;
    this.chassis.invInertia.z = 0;
    this.chassis.updateInertiaWorld(true);
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassis,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });
    const positions = [
      [-0.84, -0.29, -1.155], [0.83, -0.29, -1.155],
      [-0.82, -0.29, 1.495], [0.82, -0.29, 1.495],
    ];
    positions.forEach(([x, y, z], index) => this.vehicle.addWheel({
      chassisConnectionPointLocal: new CANNON.Vec3(x, y, z),
      directionLocal: new CANNON.Vec3(0, -1, 0),
      axleLocal: new CANNON.Vec3(1, 0, 0),
      radius: 0.35,
      suspensionRestLength: 0.12,
      maxSuspensionTravel: 0.16,
      suspensionStiffness: 30,
      dampingRelaxation: 3.5,
      dampingCompression: 4.5,
      maxSuspensionForce: 18000,
      frictionSlip: 3,
      rollInfluence: 0.01,
      isFrontWheel: index < 2,
    }));
    this.vehicle.addToWorld(this.world);
    this.world.addEventListener('postStep', () => {
      // Cannon's applyImpulse bypasses angularFactor; discard those forbidden
      // angular velocities before the next suspension/braking calculation.
      this.chassis.angularVelocity.x = 0;
      this.chassis.angularVelocity.z = 0;
      // Four simultaneous wheel impulses can chatter around zero speed.
      // Static brake hold is grounded-only; never suppress a fall or suspension.
      if (this.brake > 0 && this.vehicle.numWheelsOnGround >= 2 &&
          Math.hypot(this.chassis.velocity.x, this.chassis.velocity.z) < 0.25 * this.brake) {
        this.chassis.velocity.x = this.chassis.velocity.z = 0;
        this.chassis.angularVelocity.y = 0;
      }
    });
    this.reset();
  }

  setGear(gear: Gear): boolean {
    if (gear !== 'D' && gear !== 'N' && gear !== 'R') return false;
    this.measureSpeed();
    // Check actual motion as well as the selected gear: N cannot bypass lockout.
    if ((gear === 'R' && this.speed > 0.5) ||
        (gear === 'D' && this.speed < -0.5) ||
        (Math.abs(this.speed) > 0.5 && this.gear !== 'N' &&
         gear !== 'N' && gear !== this.gear)) return false;
    this.gear = gear;
    return true;
  }

  reset(): void {
    this.chassis.position.set(0, 0.65, 0);
    this.chassis.quaternion.set(0, 0, 0, 1);
    this.chassis.previousPosition.copy(this.chassis.position);
    this.chassis.interpolatedPosition.copy(this.chassis.position);
    this.chassis.previousQuaternion.copy(this.chassis.quaternion);
    this.chassis.interpolatedQuaternion.copy(this.chassis.quaternion);
    this.chassis.velocity.setZero();
    this.chassis.angularVelocity.setZero();
    this.chassis.force.setZero();
    this.chassis.torque.setZero();
    this.chassis.aabbNeedsUpdate = true;
    this.chassis.wakeUp();
    this.world.accumulator = 0;
    this.world.broadphase.dirty = true;
    this.speed = this.steering = this.throttle = this.brake = 0;
    this.gear = 'D';
    this.vehicle.currentVehicleSpeedKmHour = 0;
    this.vehicle.numWheelsOnGround = 0;
    this.vehicle.sliding = false;
    this.vehicle.wheelInfos.forEach((wheel, i) => {
      wheel.engineForce = wheel.brake = wheel.steering = 0;
      wheel.rotation = wheel.deltaRotation = 0;
      wheel.suspensionLength = wheel.suspensionRestLength;
      wheel.suspensionForce = wheel.suspensionRelativeVelocity = 0;
      wheel.forwardImpulse = wheel.sideImpulse = 0;
      wheel.sliding = wheel.isInContact = false;
      wheel.raycastResult.reset();
      this.vehicle.updateWheelTransform(i);
    });
  }

  update(dt: number, input: DrivingInput): void {
    this.throttle = clamp(input.throttle, 0, 1);
    this.brake = clamp(input.brake, 0, 1);
    this.measureSpeed();
    // Reduce steering at road speed; full parking lock is 30 degrees.
    this.steering = clamp(input.steer, -1, 1) * (Math.PI / 6) /
      (1 + Math.abs(this.speed) * 0.065);
    const direction = this.gear === 'D' ? 1 : this.gear === 'R' ? -1 : 0;
    const limit = this.gear === 'R' ? 5 : 12.5;
    const power = 2100 * this.throttle * (1 - this.brake) *
      Math.max(0, 1 - Math.pow(Math.max(0, this.speed * direction) / limit, 4));
    for (let i = 0; i < 4; i++) {
      // Cannon uses up cross right = -Z: positive engine force drives forward.
      this.vehicle.applyEngineForce(i >= 2 ? direction * power : 0, i);
      this.vehicle.setSteeringValue(i < 2 ? this.steering : 0, i);
      this.vehicle.setBrake(this.brake * 100, i);
    }
    this.world.step(1 / 60, clamp(dt, 0, 0.05), 3);
    this.measureSpeed();
  }

  /** Add an axis-aligned static box, with centre (x,y,z) and full dimensions. */
  addBox(x: number, y: number, z: number, sx: number, sy: number, sz: number): void {
    if (![x, y, z, sx, sy, sz].every(Number.isFinite) || sx <= 0 || sy <= 0 || sz <= 0) {
      throw new RangeError('Box coordinates must be finite and dimensions positive');
    }
    this.world.addBody(new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(x, y, z),
      shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
    }));
  }

  private measureSpeed(): void {
    this.chassis.vectorToWorldFrame(new CANNON.Vec3(0, 0, -1), this.forward);
    this.speed = this.chassis.velocity.dot(this.forward);
  }
}
