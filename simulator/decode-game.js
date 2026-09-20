/**
 * Deterministic DECODE competition-robot TeleOp game physics.
 *
 * The core is dependency-free so the browser view and Node regression tests
 * exercise exactly the same artifact transitions and projectile calculations.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TelemarkDecodeGame = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ARTIFACT_STATES = Object.freeze({
    FIELD: "FIELD",
    INTAKE: "INTAKE",
    TRANSFER: "TRANSFER",
    READY: "READY",
    FEEDING: "FEEDING",
    FLIGHT: "FLIGHT",
    SCORED: "SCORED",
    MISSED: "MISSED",
  });

  const MODES = Object.freeze({PRACTICE: "practice", MATCH: "match"});

  // The final segment of the internal feed follows this control point into
  // the hood exit. Its end tangent matches hoodAngleRadians, so an artifact
  // leaves the visible flywheel path without changing direction abruptly.
  const FLYWHEEL_FEED_START = Object.freeze({x: -0.260, y: 0.390, z: 0.030});
  const FLYWHEEL_HOOD_CONTROL = Object.freeze({x: -0.180, y: 0.42055, z: -0.22647});
  const FLYWHEEL_EXIT = Object.freeze({x: -0.180, y: 0.480, z: -0.280});

  const DEFAULT_SPAWNS = Object.freeze([
    [-2.48, -0.60], [-2.225, -0.60], [-1.97, -0.60],
    [-2.48, 0.60], [-2.225, 0.60], [-1.97, 0.60],
    [-2.48, 1.80], [-2.225, 1.80], [-1.97, 1.80],
    [2.48, -0.60], [2.225, -0.60], [1.97, -0.60],
    [2.48, 0.60], [2.225, 0.60], [1.97, 0.60],
    [2.48, 1.80], [2.225, 1.80], [1.97, 1.80],
  ].map(function (point) { return Object.freeze({x: point[0], y: 0.13, z: point[1]}); }));

  const DEFAULT_MANIFEST = Object.freeze({
    scale: 1,
    origin: Object.freeze({x: 0, y: 0, z: 0}),
    boundaries: Object.freeze({minX: -3.6, maxX: 3.6, minZ: -3.6, maxZ: 3.6}),
    goalOpening: Object.freeze({
      planeZ: -3.28,
      minX: 2.18,
      maxX: 3.58,
      minY: 0.72,
      maxY: 1.72,
    }),
    goalOpenings: Object.freeze([
      Object.freeze({id: "blue-goal", planeZ: -3.28, minX: 2.18, maxX: 3.58, minY: 0.72, maxY: 1.72}),
      Object.freeze({id: "red-goal", planeZ: -3.28, minX: -3.58, maxX: -2.18, minY: 0.72, maxY: 1.72}),
    ]),
    collisionAreas: Object.freeze([
      Object.freeze({id: "goal-left", minX: -1.02, maxX: -0.72, minZ: -3.38, maxZ: -3.18}),
      Object.freeze({id: "goal-right", minX: 0.72, maxX: 1.02, minZ: -3.38, maxZ: -3.18}),
    ]),
    artifactSpawnPoints: DEFAULT_SPAWNS,
  });

  const DEFAULTS = Object.freeze({
    fixedStep: 1 / 120,
    matchSeconds: 120,
    matchArtifacts: 18,
    practiceArtifacts: 9,
    maximumControlledArtifacts: 3,
    intakeThreshold: 0.22,
    transferThreshold: 0.22,
    triggerActivationDelta: 0.2,
    triggerFeedSeconds: 0.1,
    pickupRadius: 0.32,
    artifactRadius: 0.125,
    gravity: 9.81,
    hoodAngleRadians: 48 * Math.PI / 180,
    velocityScale: 0.00315,
    maximumFlightSeconds: 4.5,
    lenientGoalMinimumY: 0.45,
    lenientGoalMaximumY: 2.8,
    goalTriangleDepth: 1.15,
    goalTrianglePadding: 0.16,
  });

  function finite(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finite(value, 0)));
  }

  function copyPoint(point) {
    return {x: finite(point && point.x, 0), y: finite(point && point.y, 0), z: finite(point && point.z, 0)};
  }

  function normalizeMode(mode) {
    return String(mode).toLowerCase() === MODES.MATCH ? MODES.MATCH : MODES.PRACTICE;
  }

  function localToWorld(robot, x, y, z) {
    const heading = finite(robot.heading, 0);
    const cosine = Math.cos(heading);
    const sine = Math.sin(heading);
    return {
      x: robot.x + cosine * x - sine * z,
      y: y,
      z: robot.z + sine * x + cosine * z,
    };
  }

  function launchVector(robot, measuredVelocity, settings) {
    const speed = Math.abs(finite(measuredVelocity, 0)) * settings.velocityScale;
    const horizontalSpeed = speed * Math.cos(settings.hoodAngleRadians);
    const spinDirection = finite(measuredVelocity, 0) < 0 ? -1 : 1;
    const forwardX = Math.sin(robot.heading);
    const forwardZ = -Math.cos(robot.heading);
    // The presentation rotates the uploaded KG CAD by a half-turn so its
    // physical intake faces simulator-forward. Mirror the CAD-local launcher
    // offset through that same half-turn: the flywheel sits on robot-left.
    const muzzle = localToWorld(robot, FLYWHEEL_EXIT.x, FLYWHEEL_EXIT.y, FLYWHEEL_EXIT.z);
    return {
      position: muzzle,
      velocity: {
        x: forwardX * horizontalSpeed * spinDirection + robot.velocityX,
        y: speed * Math.sin(settings.hoodAngleRadians) * spinDirection,
        z: forwardZ * horizontalSpeed * spinDirection + robot.velocityZ,
      },
      speed,
    };
  }

  function projectileStep(projectile, dt, gravity) {
    const previous = {x: projectile.x, y: projectile.y, z: projectile.z};
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt - 0.5 * gravity * dt * dt;
    projectile.z += projectile.vz * dt;
    projectile.vy -= gravity * dt;
    return previous;
  }

  function goalCrossing(previous, current, opening, radius) {
    const before = previous.z - opening.planeZ;
    const after = current.z - opening.planeZ;
    if (!(before > 0 && after <= 0)) return null;
    const amount = before / Math.max(0.000001, before - after);
    const x = previous.x + (current.x - previous.x) * amount;
    const y = previous.y + (current.y - previous.y) * amount;
    return {
      x,
      y,
      scored: x >= opening.minX + radius
        && x <= opening.maxX - radius
        && y >= opening.minY + radius
        && y <= opening.maxY - radius,
    };
  }

  function practiceGoalOpenings(manifest) {
    if (Array.isArray(manifest.goalOpenings) && manifest.goalOpenings.length >= 2) {
      return manifest.goalOpenings.map(function (opening) { return Object.assign({}, opening); });
    }
    const primary = manifest.goalOpening;
    return [
      Object.assign({id: "blue-goal"}, primary),
      Object.assign({}, primary, {id: "red-goal", minX: -primary.maxX, maxX: -primary.minX}),
    ];
  }

  function scoringOpenings(manifest, mode) {
    return normalizeMode(mode) === MODES.PRACTICE
      ? practiceGoalOpenings(manifest)
      : [Object.assign({id: "match-goal"}, manifest.goalOpening)];
  }

  function pointInTriangleXZ(point, vertices) {
    function sign(first, second, third) {
      return (first.x - third.x) * (second.z - third.z)
        - (second.x - third.x) * (first.z - third.z);
    }
    const first = sign(point, vertices[0], vertices[1]);
    const second = sign(point, vertices[1], vertices[2]);
    const third = sign(point, vertices[2], vertices[0]);
    const hasNegative = first < 0 || second < 0 || third < 0;
    const hasPositive = first > 0 || second > 0 || third > 0;
    return !(hasNegative && hasPositive);
  }

  function goalTriangle(opening, settings) {
    const centerX = (opening.minX + opening.maxX) / 2;
    return [
      {x: opening.minX - settings.goalTrianglePadding, z: opening.planeZ + 0.04},
      {x: opening.maxX + settings.goalTrianglePadding, z: opening.planeZ + 0.04},
      {x: centerX, z: opening.planeZ + settings.goalTriangleDepth},
    ];
  }

  function lenientGoalContact(previous, current, openings, settings) {
    for (const opening of openings) {
      const exact = goalCrossing(previous, current, opening, settings.artifactRadius);
      if (exact && exact.scored) return {scored: true, goal: opening.id, contact: "opening"};

      // A descending shot that reaches the broad back panel counts even when
      // it entered a little high or glanced an edge instead of crossing the
      // strict rectangular opening.
      if (exact) {
        const xPadding = settings.goalTrianglePadding;
        if (exact.x >= opening.minX - xPadding
            && exact.x <= opening.maxX + xPadding
            && exact.y >= settings.lenientGoalMinimumY
            && exact.y <= settings.lenientGoalMaximumY) {
          return {scored: true, goal: opening.id, contact: "back-wall"};
        }
      }

      const triangle = goalTriangle(opening, settings);
      for (let sample = 0; sample <= 4; sample += 1) {
        const amount = sample / 4;
        const point = {
          x: previous.x + (current.x - previous.x) * amount,
          y: previous.y + (current.y - previous.y) * amount,
          z: previous.z + (current.z - previous.z) * amount,
        };
        if (point.y >= settings.lenientGoalMinimumY
            && point.y <= settings.lenientGoalMaximumY
            && pointInTriangleXZ(point, triangle)) {
          return {scored: true, goal: opening.id, contact: "triangle"};
        }
      }
    }
    return null;
  }

  function predictTrajectory(robotInput, measuredVelocity, options) {
    const settings = Object.assign({}, DEFAULTS, options || {});
    const manifest = settings.manifest || DEFAULT_MANIFEST;
    const robot = Object.assign({x: 0, z: 0, heading: 0, velocityX: 0, velocityZ: 0}, robotInput || {});
    const launch = launchVector(robot, measuredVelocity, settings);
    const projectile = {
      x: launch.position.x,
      y: launch.position.y,
      z: launch.position.z,
      vx: launch.velocity.x,
      vy: launch.velocity.y,
      vz: launch.velocity.z,
    };
    const points = [copyPoint(projectile)];
    let outcome = null;
    const sampleStep = 1 / 60;
    for (let elapsed = sampleStep; elapsed <= settings.maximumFlightSeconds; elapsed += sampleStep) {
      const previous = projectileStep(projectile, sampleStep, settings.gravity);
      if (points.length % 3 === 0 || elapsed >= settings.maximumFlightSeconds) points.push(copyPoint(projectile));
      const crossing = lenientGoalContact(
        previous,
        projectile,
        scoringOpenings(manifest, settings.mode || MODES.PRACTICE),
        settings,
      );
      if (crossing) {
        outcome = ARTIFACT_STATES.SCORED;
        points.push(copyPoint(projectile));
        break;
      }
      if (projectile.y <= settings.artifactRadius) {
        outcome = ARTIFACT_STATES.MISSED;
        points.push(copyPoint(projectile));
        break;
      }
    }
    return {points, outcome: outcome || ARTIFACT_STATES.MISSED, speed: launch.speed};
  }

  function create(options) {
    const supplied = options || {};
    const settings = Object.assign({}, DEFAULTS, supplied);
    const manifest = supplied.manifest || DEFAULT_MANIFEST;
    let selectedMode = normalizeMode(supplied.mode);
    let accumulator = 0;
    let nextArtifactId = 1;
    let triggerRestPosition = null;
    let previousTriggerPosition = null;
    let triggerFirePending = false;
    let practiceSpawnCursor = 0;
    let endNotified = false;

    const state = {
      mode: selectedMode,
      running: false,
      ended: false,
      elapsed: 0,
      timeRemaining: null,
      robot: {x: 0, z: 0, heading: 0, velocityX: 0, velocityZ: 0},
      hardware: {intake: 0, transfer: 0, flywheelVelocity: 0, flywheelTarget: 0, triggerPosition: 0},
      artifacts: [],
      hits: 0,
      misses: 0,
      launches: 0,
      predictedTrajectory: [],
    };

    function spawnArtifact(point) {
      const practiceSupply = Array.isArray(manifest.practiceArtifactSpawnPoints)
        ? manifest.practiceArtifactSpawnPoints
        : manifest.artifactSpawnPoints.slice(0, settings.practiceArtifacts);
      const supply = state.mode === MODES.PRACTICE && practiceSupply.length
        ? practiceSupply
        : manifest.artifactSpawnPoints;
      const spawn = point || supply[practiceSpawnCursor % supply.length];
      practiceSpawnCursor += 1;
      const id = nextArtifactId++;
      const artifact = {
        id,
        color: (id - 1) % 3 === 0 ? "green" : "purple",
        state: ARTIFACT_STATES.FIELD,
        x: finite(spawn.x, 0),
        y: finite(spawn.y, settings.artifactRadius),
        z: finite(spawn.z, 0),
        vx: 0,
        vy: 0,
        vz: 0,
        progress: 0,
        flightTime: 0,
      };
      state.artifacts.push(artifact);
      return artifact;
    }

    function reset(mode) {
      selectedMode = normalizeMode(mode == null ? selectedMode : mode);
      state.mode = selectedMode;
      state.running = false;
      state.ended = false;
      state.elapsed = 0;
      state.timeRemaining = selectedMode === MODES.MATCH ? settings.matchSeconds : null;
      state.artifacts.length = 0;
      state.hits = 0;
      state.misses = 0;
      state.launches = 0;
      state.predictedTrajectory = [];
      accumulator = 0;
      nextArtifactId = 1;
      practiceSpawnCursor = 0;
      triggerRestPosition = null;
      previousTriggerPosition = null;
      triggerFirePending = false;
      endNotified = false;
      const count = selectedMode === MODES.MATCH ? settings.matchArtifacts : settings.practiceArtifacts;
      for (let index = 0; index < count; index += 1) {
        spawnArtifact(manifest.artifactSpawnPoints[index % manifest.artifactSpawnPoints.length]);
      }
      attachControlledArtifacts();
      updatePrediction();
      return snapshot();
    }

    function controlledArtifacts() {
      return state.artifacts.filter(function (artifact) {
        return artifact.state === ARTIFACT_STATES.INTAKE
          || artifact.state === ARTIFACT_STATES.TRANSFER
          || artifact.state === ARTIFACT_STATES.READY
          || artifact.state === ARTIFACT_STATES.FEEDING;
      });
    }

    function fieldArtifacts() {
      return state.artifacts.filter(function (artifact) { return artifact.state === ARTIFACT_STATES.FIELD; });
    }

    function attachControlledArtifacts() {
      const ready = state.artifacts.filter(function (artifact) { return artifact.state === ARTIFACT_STATES.READY; });
      const feeding = state.artifacts.some(function (artifact) { return artifact.state === ARTIFACT_STATES.FEEDING; });
      state.artifacts.forEach(function (artifact) {
        let local = null;
        if (artifact.state === ARTIFACT_STATES.INTAKE) {
          // Follow all three driven roller stages in the real KG intake. The
          // piece becomes stored automatically after the third row.
          const points = [
            {x: 0, y: 0.13, z: -0.52},
            {x: 0.020, y: 0.307, z: -0.343},
            {x: 0.035, y: 0.381, z: -0.236},
            {x: 0.050, y: 0.455, z: -0.130},
            {x: -0.260, y: 0.390, z: 0.030},
          ];
          const scaled = clamp(artifact.progress, 0, 1) * (points.length - 1);
          const segment = Math.min(points.length - 2, Math.floor(scaled));
          const amount = scaled - segment;
          local = {
            x: points[segment].x + (points[segment + 1].x - points[segment].x) * amount,
            y: points[segment].y + (points[segment + 1].y - points[segment].y) * amount,
            z: points[segment].z + (points[segment + 1].z - points[segment].z) * amount,
          };
        } else if (artifact.state === ARTIFACT_STATES.TRANSFER) {
          // Retained for saved simulator fixtures; normal intake no longer
          // enters this state because the transfer is only an anti-jam wheel.
          local = {x: -0.260, y: 0.390, z: 0.030};
        } else if (artifact.state === ARTIFACT_STATES.READY) {
          const index = Math.max(0, ready.indexOf(artifact));
          // Slot zero stays directly below the flywheel; remaining artifacts
          // form the requested horizontal three-piece magazine.
          local = {x: (index - 1 + (feeding ? 1 : 0)) * 0.26, y: 0.390, z: 0.030};
        } else if (artifact.state === ARTIFACT_STATES.FEEDING) {
          const amount = clamp(artifact.progress, 0, 1);
          const inverse = 1 - amount;
          local = {
            x: inverse * inverse * FLYWHEEL_FEED_START.x
              + 2 * inverse * amount * FLYWHEEL_HOOD_CONTROL.x
              + amount * amount * FLYWHEEL_EXIT.x,
            y: inverse * inverse * FLYWHEEL_FEED_START.y
              + 2 * inverse * amount * FLYWHEEL_HOOD_CONTROL.y
              + amount * amount * FLYWHEEL_EXIT.y,
            z: inverse * inverse * FLYWHEEL_FEED_START.z
              + 2 * inverse * amount * FLYWHEEL_HOOD_CONTROL.z
              + amount * amount * FLYWHEEL_EXIT.z,
          };
        }
        if (!local) return;
        const world = localToWorld(state.robot, local.x, local.y, local.z);
        artifact.x = world.x;
        artifact.y = world.y;
        artifact.z = world.z;
      });
    }

    function beginIntake() {
      if (state.hardware.intake <= settings.intakeThreshold) return;
      if (controlledArtifacts().length >= settings.maximumControlledArtifacts) return;
      // Simulator-forward is local -Z. This pickup point matches the visible
      // front of the half-turned KG CAD rather than its rear bumper.
      const mouth = localToWorld(state.robot, 0, settings.artifactRadius, -0.48);
      const candidate = fieldArtifacts().map(function (artifact) {
        return {artifact, distance: Math.hypot(artifact.x - mouth.x, artifact.z - mouth.z)};
      }).filter(function (entry) {
        return entry.distance <= settings.pickupRadius;
      }).sort(function (left, right) {
        return left.distance - right.distance || left.artifact.id - right.artifact.id;
      })[0];
      if (!candidate) return;
      candidate.artifact.state = ARTIFACT_STATES.INTAKE;
      candidate.artifact.progress = 0;
    }

    function advanceMechanisms(dt) {
      beginIntake();
      const intake = state.artifacts.find(function (artifact) { return artifact.state === ARTIFACT_STATES.INTAKE; });
      if (intake) {
        intake.progress = clamp(intake.progress + state.hardware.intake * dt, 0, 1);
        if (state.hardware.intake < -settings.intakeThreshold && intake.progress <= 0) {
          intake.state = ARTIFACT_STATES.FIELD;
          const mouth = localToWorld(state.robot, 0, settings.artifactRadius, -0.50);
          Object.assign(intake, mouth);
        } else if (intake.progress >= 1) {
          intake.state = ARTIFACT_STATES.READY;
          intake.progress = 0;
        }
      }

      // The transfer motor drives only the small anti-jam spinner near the
      // flywheel. It intentionally does not move a normally flowing artifact.
      const transfer = state.artifacts.find(function (artifact) { return artifact.state === ARTIFACT_STATES.TRANSFER; });
      if (transfer) {
        transfer.state = ARTIFACT_STATES.READY;
        transfer.progress = 0;
      }
      attachControlledArtifacts();
    }

    function beginTriggerFeed() {
      const artifact = state.artifacts.find(function (candidate) { return candidate.state === ARTIFACT_STATES.READY; });
      if (!artifact) return false;
      artifact.state = ARTIFACT_STATES.FEEDING;
      artifact.progress = 0;
      attachControlledArtifacts();
      return true;
    }

    function launchFeedingArtifact(artifact) {
      const launch = launchVector(state.robot, state.hardware.flywheelVelocity, settings);
      artifact.state = ARTIFACT_STATES.FLIGHT;
      Object.assign(artifact, launch.position, {
        vx: launch.velocity.x,
        vy: launch.velocity.y,
        vz: launch.velocity.z,
        flightTime: 0,
        progress: 0,
      });
      state.launches += 1;
      return true;
    }

    function advanceTriggerFeed(dt, triggerActive) {
      const artifact = state.artifacts.find(function (candidate) { return candidate.state === ARTIFACT_STATES.FEEDING; });
      if (!artifact) return;
      if (!triggerActive) {
        artifact.state = ARTIFACT_STATES.READY;
        artifact.progress = 0;
        attachControlledArtifacts();
        return;
      }
      artifact.progress = clamp(artifact.progress + dt / settings.triggerFeedSeconds, 0, 1);
      attachControlledArtifacts();
      if (artifact.progress >= 1) launchFeedingArtifact(artifact);
    }

    function triggerIsActive() {
      return triggerRestPosition != null
        && Math.abs(state.hardware.triggerPosition - triggerRestPosition) >= settings.triggerActivationDelta;
    }

    function resolveArtifact(artifact, result) {
      artifact.state = result;
      artifact.vx = 0;
      artifact.vy = 0;
      artifact.vz = 0;
      if (result === ARTIFACT_STATES.SCORED) state.hits += 1;
      else state.misses += 1;
      if (state.mode === MODES.PRACTICE) spawnArtifact();
    }

    function advanceFlights(dt) {
      state.artifacts.filter(function (artifact) { return artifact.state === ARTIFACT_STATES.FLIGHT; }).forEach(function (artifact) {
        const previous = projectileStep(artifact, dt, settings.gravity);
        artifact.flightTime += dt;
        const crossing = lenientGoalContact(previous, artifact, scoringOpenings(manifest, state.mode), settings);
        if (crossing) {
          resolveArtifact(artifact, ARTIFACT_STATES.SCORED);
          return;
        }
        const boundaries = manifest.boundaries;
        if (artifact.y <= settings.artifactRadius
            || artifact.flightTime >= settings.maximumFlightSeconds
            || artifact.x < boundaries.minX || artifact.x > boundaries.maxX
            || artifact.z < boundaries.minZ || artifact.z > boundaries.maxZ) {
          resolveArtifact(artifact, ARTIFACT_STATES.MISSED);
        }
      });
    }

    function finishMatch() {
      state.running = false;
      state.ended = true;
      state.timeRemaining = 0;
      if (!endNotified && typeof supplied.onEnd === "function") {
        endNotified = true;
        supplied.onEnd(snapshot());
      }
    }

    function fixedUpdate(dt, triggerFired) {
      state.elapsed += dt;
      if (state.mode === MODES.MATCH) {
        state.timeRemaining = Math.max(0, settings.matchSeconds - state.elapsed);
        if (state.timeRemaining <= 0) {
          finishMatch();
          return;
        }
      }
      advanceMechanisms(dt);
      if (triggerFired) beginTriggerFeed();
      advanceTriggerFeed(dt, triggerIsActive());
      advanceFlights(dt);
    }

    function updateFrame(frame) {
      const data = frame || {};
      const robot = data.robot || {};
      state.robot = {
        x: finite(robot.x, state.robot.x),
        z: finite(robot.z, state.robot.z),
        heading: finite(robot.heading, state.robot.heading),
        velocityX: finite(robot.velocityX, 0),
        velocityZ: finite(robot.velocityZ, 0),
      };
      const hardware = data.hardware || {};
      state.hardware = {
        intake: clamp(hardware.intake, -1, 1),
        transfer: clamp(hardware.transfer, -1, 1),
        flywheelVelocity: finite(hardware.flywheelVelocity, 0),
        flywheelTarget: finite(hardware.flywheelTarget, 0),
        triggerPosition: clamp(hardware.triggerPosition, 0, 1),
      };
      if (triggerRestPosition == null || previousTriggerPosition == null) {
        triggerRestPosition = state.hardware.triggerPosition;
        previousTriggerPosition = state.hardware.triggerPosition;
        return false;
      }
      const previousDistance = Math.abs(previousTriggerPosition - triggerRestPosition);
      const currentDistance = Math.abs(state.hardware.triggerPosition - triggerRestPosition);
      previousTriggerPosition = state.hardware.triggerPosition;
      return previousDistance < settings.triggerActivationDelta
        && currentDistance >= settings.triggerActivationDelta;
    }

    function step(seconds, frame) {
      const triggerFired = updateFrame(frame);
      if (!state.running) {
        triggerFirePending = false;
        attachControlledArtifacts();
        updatePrediction();
        return snapshot();
      }
      triggerFirePending = triggerFirePending || triggerFired;
      accumulator += clamp(seconds, 0, 0.25);
      let firstUpdate = true;
      while (accumulator + 1e-10 >= settings.fixedStep && state.running) {
        const fireOnThisUpdate = triggerFirePending && firstUpdate;
        fixedUpdate(settings.fixedStep, fireOnThisUpdate);
        if (fireOnThisUpdate) triggerFirePending = false;
        firstUpdate = false;
        accumulator -= settings.fixedStep;
      }
      updatePrediction();
      return snapshot();
    }

    function updatePrediction() {
      state.predictedTrajectory = state.mode === MODES.PRACTICE
        ? predictTrajectory(state.robot, state.hardware.flywheelVelocity, Object.assign({}, settings, {manifest, mode: state.mode})).points
        : [];
    }

    function snapshot() {
      const attempts = state.hits + state.misses;
      return {
        mode: state.mode,
        running: state.running,
        ended: state.ended,
        elapsed: state.elapsed,
        timeRemaining: state.timeRemaining,
        robot: Object.assign({}, state.robot),
        hardware: Object.assign({}, state.hardware),
        artifacts: state.artifacts.map(function (artifact) { return Object.assign({}, artifact); }),
        hits: state.hits,
        misses: state.misses,
        launches: state.launches,
        accuracy: attempts ? state.hits / attempts : 0,
        controlledArtifacts: controlledArtifacts().length,
        fieldArtifacts: fieldArtifacts().length,
        predictedTrajectory: state.predictedTrajectory.map(copyPoint),
      };
    }

    function start() {
      if (!state.ended) state.running = true;
      return snapshot();
    }

    function stop() {
      state.running = false;
      return snapshot();
    }

    function setMode(mode) {
      return reset(mode);
    }

    function setTriggerRestPosition(position) {
      triggerRestPosition = clamp(position, 0, 1);
      previousTriggerPosition = triggerRestPosition;
      state.hardware.triggerPosition = triggerRestPosition;
      return triggerRestPosition;
    }

    // Tests and the browser fixture use this to build a ready magazine without
    // bypassing any launch or projectile logic.
    function setArtifactState(id, nextState, progress) {
      const artifact = state.artifacts.find(function (candidate) { return candidate.id === id; });
      if (!artifact || !Object.prototype.hasOwnProperty.call(ARTIFACT_STATES, nextState)) return false;
      artifact.state = ARTIFACT_STATES[nextState];
      artifact.progress = clamp(progress, 0, 1);
      attachControlledArtifacts();
      return true;
    }

    reset(selectedMode);
    return Object.freeze({
      state,
      start,
      stop,
      reset,
      setMode,
      setTriggerRestPosition,
      step,
      snapshot,
      setArtifactState,
      launchReadyArtifact: beginTriggerFeed,
    });
  }

  return Object.freeze({
    states: ARTIFACT_STATES,
    modes: MODES,
    defaults: DEFAULTS,
    defaultManifest: DEFAULT_MANIFEST,
    create,
    predictTrajectory,
    localToWorld,
    scoringOpenings,
    goalTriangle,
    lenientGoalContact,
  });
});
