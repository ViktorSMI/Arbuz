from pathlib import Path
import hashlib

path = Path('js/art/procedural-locomotion.js')
data = path.read_text(encoding='utf-8')
assert hashlib.sha256(data.encode()).hexdigest() == 'ecb9f2e3f5cf7154c6f8e82278325a4f5deaff47c418561c988e026a48e8e0b6'

replacements = [
("""    this.phase = 0;
    this.distance = 0;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.acceleration = 0;
    this.previousSpeed = 0;
    this.weight = { value: 0, velocity: 0 };
    this.lean = { value: 0, velocity: 0 };
    this.sideLean = { value: 0, velocity: 0 };
    this.turnLean = { value: 0, velocity: 0 };
""", """    this.phase = 0;
    this.distance = 0;
    this.frames = 0;
    this.instantSpeed = 0;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.acceleration = 0;
    this.weight = { value: 0, velocity: 0 };
    this.lean = { value: 0, velocity: 0 };
    this.sideLean = { value: 0, velocity: 0 };
"""),
("""    this.roll = { active: false, distance: 0, angle: 0, angularVelocity: 0, radius: DODGE_SPEED * DODGE_DURATION / TAU };
""", """    this.roll = { active: false, frames: 0, distance: 0, angle: 0, angularVelocity: 0, radius: DODGE_SPEED * DODGE_DURATION / TAU };
"""),
("""    const velocitySpeed = player?.vel ? Math.hypot(player.vel.x || 0, player.vel.z || 0) : 0;
    const measuredSpeed = dt > 0 && distance > 1e-6 ? distance / dt : velocitySpeed;
    const targetSpeed = Math.min(PLAYER_SPRINT * 1.4, Math.max(measuredSpeed, velocitySpeed * .8));
    const oldSpeed = this.speed;
    this.speed = damp(this.speed, targetSpeed, 13, dt);
    this.acceleration = damp(this.acceleration, dt > 0 ? (this.speed - oldSpeed) / dt : 0, 8, dt);
    this.previousSpeed = oldSpeed;
""", """    const velocitySpeed = player?.vel ? Math.hypot(player.vel.x || 0, player.vel.z || 0) : 0;
    if (this.frames === 0 && distance <= 1e-6 && dt > 0 && velocitySpeed > 0) distance = velocitySpeed * dt;
    this.frames++;
    const measuredSpeed = dt > 0 && distance > 1e-6 ? distance / dt : 0;
    this.instantSpeed = measuredSpeed;
    const targetSpeed = Math.min(PLAYER_SPRINT * 1.4, measuredSpeed);
    const oldSpeed = this.speed;
    this.speed = damp(this.speed, targetSpeed, 13, dt);
    this.acceleration = damp(this.acceleration, dt > 0 ? (this.speed - oldSpeed) / dt : 0, 8, dt);
"""),
("""    const active = (state === 'walk' || state === 'run') && player.grounded !== false;
    const weight = spring(this.weight, active ? 1 : 0, dt, active ? 18 : 14);
""", """    const active = (state === 'walk' || state === 'run') && player.grounded !== false;
    if (!active && state !== 'idle') {
      this.weight.value = this.weight.velocity = 0;
      for (const foot of Object.values(this.feet)) foot.planted = foot.wasStance = false;
      return { applied: false, speed: this.speed, normalizedSpeed: clamp(this.speed / PLAYER_SPRINT, 0, 1) };
    }
    const weight = spring(this.weight, active ? 1 : 0, dt, active ? 18 : 14);
"""),
("""    const runBlend = clamp((this.speed - 5.5) / (PLAYER_SPRINT - 5.5), 0, 1);
    const strideDistance = THREE.MathUtils.lerp(2.55, 4.15, runBlend);
    this.phase = advanceStridePhase(this.phase, active ? distance : 0, strideDistance);
    const phaseRate = strideDistance > 0 ? this.speed / strideDistance : 0;
""", """    const runBlend = clamp((this.speed - 5.5) / (PLAYER_SPRINT - 5.5), 0, 1);
    const phaseRunBlend = clamp((this.instantSpeed - 5.5) / (PLAYER_SPRINT - 5.5), 0, 1);
    const strideDistance = THREE.MathUtils.lerp(2.55, 4.15, phaseRunBlend);
    this.phase = advanceStridePhase(this.phase, active ? distance : 0, strideDistance);
    const phaseRate = strideDistance > 0 ? this.instantSpeed / strideDistance : 0;
"""),
("""    if (state !== 'dodge') {
      this.roll.active = false;
      return false;
    }
    if (!this.roll.active) {
      this.roll.active = true;
      this.roll.distance = 0;
""", """    if (state !== 'dodge') {
      if (this.roll.active && distance > 0) {
        this.roll.distance += distance;
        this.roll.angle = rollAngleFromDistance(this.roll.distance, this.roll.radius);
      }
      this.roll.active = false;
      return false;
    }
    if (!this.roll.active) {
      this.roll.active = true;
      this.roll.frames = 0;
      this.roll.distance = 0;
"""),
("""    let travel = distance;
    if (!(travel > 1e-5) && player?.vel) travel = Math.min(DODGE_SPEED * dt * 1.25, horizontalLength(player.vel) * dt);
    this.roll.distance += Math.max(0, travel);
""", """    let travel = distance;
    if (!(travel > 1e-5) && this.roll.frames === 0 && player?.vel)
      travel = Math.min(DODGE_SPEED * dt * 1.25, horizontalLength(player.vel) * dt);
    this.roll.frames++;
    this.roll.distance += Math.max(0, travel);
"""),
]

for old, new in replacements:
    assert data.count(old) == 1, old[:80]
    data = data.replace(old, new, 1)

assert hashlib.sha256(data.encode()).hexdigest() == '27fa0a6a7a4b6de2890a218ee4f60059b09ba375251bd9c8194711de0970ecf1'
path.write_text(data, encoding='utf-8')
print('Frame-rate invariant gait patch applied')
