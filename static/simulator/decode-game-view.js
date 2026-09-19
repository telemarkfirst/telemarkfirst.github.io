/** Browser presentation for the deterministic DECODE competition game core. */
(function (global) {
  "use strict";

  const MANIFEST_URL = "./models/decode-field.manifest.json";

  function installStyles() {
    if (document.getElementById("decode-game-styles")) return;
    const style = document.createElement("style");
    style.id = "decode-game-styles";
    style.textContent = ""
      + ".decode-game-hud{position:absolute;z-index:4;top:48px;right:10px;width:min(310px,calc(100% - 20px));padding:8px;border:1px solid rgba(148,163,184,.3);border-radius:9px;background:rgba(5,8,13,.82);color:#e5eef5;font:600 .69rem/1.3 var(--font-ui);backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,.18)}"
      + ".decode-mode-row{display:flex;align-items:center;gap:5px}.decode-mode-row strong{margin-right:auto;font-size:.73rem;letter-spacing:.04em}.decode-mode-button{padding:3px 8px;border:1px solid rgba(148,163,184,.35);border-radius:6px;background:rgba(15,23,42,.75);color:#cbd5e1;font:700 .65rem/1.35 var(--font-ui);cursor:pointer}.decode-mode-button[aria-pressed='true']{border-color:#22d3ee;color:#a5f3fc;background:rgba(8,145,178,.18)}"
      + ".decode-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:7px}.decode-stat{padding:4px 5px;border-radius:5px;background:rgba(148,163,184,.1);font-weight:500;color:#9fb2c2}.decode-stat b{display:block;color:#f8fafc;font:700 .72rem/1.25 var(--font-code)}"
      + ".decode-velocity{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:6px;color:#aab9c6;font:500 .64rem/1.3 var(--font-code)}.decode-velocity b{color:#fde68a}"
      + ".decode-shot-recipe{margin:7px 0 0;padding:6px 7px;border:1px solid rgba(103,232,249,.22);border-radius:5px;background:rgba(8,145,178,.09);color:#cbd5e1;font:500 .63rem/1.42 var(--font-ui)}.decode-shot-recipe b{color:#67e8f9}"
      + ".decode-controls{margin-top:6px;color:#9fb2c2;font-weight:500}.decode-controls summary{cursor:pointer;color:#cbd5e1;font-weight:700}.decode-controls p{margin:5px 0 0;font-size:.62rem;line-height:1.45}"
      + ":root[data-theme='light'] .decode-game-hud,:root[data-telemark-theme='light'] .decode-game-hud{background:rgba(255,255,255,.9);color:#163047;border-color:rgba(71,100,119,.28)}"
      + ":root[data-theme='light'] .decode-mode-button,:root[data-telemark-theme='light'] .decode-mode-button{background:#edf3f6;color:#365265}"
      + ":root[data-theme='light'] .decode-stat,:root[data-telemark-theme='light'] .decode-stat{background:rgba(40,73,91,.08);color:#536b7a}"
      + ":root[data-theme='light'] .decode-stat b,:root[data-telemark-theme='light'] .decode-stat b{color:#17384b}"
      + ":root[data-theme='light'] .decode-velocity b,:root[data-telemark-theme='light'] .decode-velocity b{color:#925300}"
      + ":root[data-theme='light'] .decode-shot-recipe,:root[data-telemark-theme='light'] .decode-shot-recipe{background:rgba(8,145,178,.07);color:#365265}:root[data-theme='light'] .decode-shot-recipe b,:root[data-telemark-theme='light'] .decode-shot-recipe b{color:#087f95}"
      + "@media(max-width:620px){.decode-game-hud{width:245px}.decode-controls p{font-size:.59rem}.decode-stats{grid-template-columns:repeat(3,1fr)}}";
    document.head.appendChild(style);
  }

  function createHud(container, initialMode) {
    const hud = document.createElement("section");
    hud.className = "decode-game-hud";
    hud.setAttribute("aria-label", "DECODE TeleOp match status");
    hud.innerHTML = ""
      + "<div class=\"decode-mode-row\"><strong>DECODE · Competition robot</strong>"
      + "<button class=\"decode-mode-button\" type=\"button\" data-decode-mode=\"practice\">Practice</button>"
      + "<button class=\"decode-mode-button\" type=\"button\" data-decode-mode=\"match\">Match</button></div>"
      + "<div class=\"decode-stats\">"
      + "<span class=\"decode-stat\">Time<b data-decode-stat=\"time\">Practice</b></span>"
      + "<span class=\"decode-stat\">Hits / misses<b data-decode-stat=\"score\">0 / 0</b></span>"
      + "<span class=\"decode-stat\">Accuracy<b data-decode-stat=\"accuracy\">0%</b></span>"
      + "<span class=\"decode-stat\">On robot<b data-decode-stat=\"capacity\">0 / 3</b></span>"
      + "<span class=\"decode-stat\">Field supply<b data-decode-stat=\"supply\">9</b></span>"
      + "<span class=\"decode-stat\">Trajectory<b data-decode-stat=\"trajectory\">Shown</b></span>"
      + "</div>"
      + "<div class=\"decode-velocity\"><span>target <b data-decode-stat=\"target\">0</b> ticks/s</span>"
      + "<span>measured <b data-decode-stat=\"measured\">0</b> ticks/s</span>"
      + "<span>trigger <b data-decode-stat=\"trigger\">0.00</b></span>"
      + "<span>flow <b data-decode-stat=\"flow\">field</b></span></div>"
      + "<p class=\"decode-shot-recipe\"><b>Successful hardware sequence:</b> Run the intake forward for about 1 s at full power; its three roller stages automatically carry the artifact into storage. Hold the launcher near 1900 ticks/s, then move the <code>launcher_trigger</code> servo from its configured rest position to its fire position for at least 0.10 s before returning it to rest. The transfer drives only the small anti-jam spinner near the flywheel and is not required for a normal shot. Servo positions are 0–1; 1900 is the flywheel motor velocity.</p>"
      + "<details class=\"decode-controls\"><summary>Aiming and code notes</summary><p>Your code chooses the gamepad bindings. Both goals count in Practice. A shot scores when it enters an opening, reaches a goal back wall from above, or crosses the forgiving triangular catch region immediately in front of either goal. Resolved Practice artifacts replenish on their original field side. FTC stick up is −1; convert it to positive forward once in your Java drive code.</p></details>";
    container.appendChild(hud);

    function selectMode(mode) {
      hud.querySelectorAll("[data-decode-mode]").forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.dataset.decodeMode === mode));
      });
    }
    selectMode(initialMode);
    return {element: hud, selectMode};
  }

  function box(THREE, parent, size, position, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function createProceduralField(THREE, visual, manifest) {
    const group = new THREE.Group();
    group.name = "decode-procedural-field";
    group.userData.telemarkDecodeFallback = true;
    visual.add(group);
    const neutral = new THREE.MeshPhongMaterial({color: 0xcbd5e1, shininess: 45});
    const goal = new THREE.MeshPhongMaterial({color: 0x22d3ee, emissive: 0x083344, emissiveIntensity: 0.2});
    const marker = new THREE.MeshBasicMaterial({color: 0x60a5fa, transparent: true, opacity: 0.26, side: THREE.DoubleSide});
    const openings = Array.isArray(manifest.goalOpenings) && manifest.goalOpenings.length
      ? manifest.goalOpenings
      : [manifest.goalOpening];
    openings.forEach(function (opening) {
      const centerX = (opening.minX + opening.maxX) / 2;
      const width = opening.maxX - opening.minX;
      const centerY = (opening.minY + opening.maxY) / 2;
      const height = opening.maxY - opening.minY;
      box(THREE, group, [0.09, height + 0.32, 0.12], [opening.minX - 0.05, centerY, opening.planeZ], goal);
      box(THREE, group, [0.09, height + 0.32, 0.12], [opening.maxX + 0.05, centerY, opening.planeZ], goal);
      box(THREE, group, [width + 0.2, 0.09, 0.12], [centerX, opening.minY - 0.05, opening.planeZ], neutral);
      box(THREE, group, [width + 0.2, 0.09, 0.12], [centerX, opening.maxY + 0.05, opening.planeZ], neutral);
      box(THREE, group, [width + 0.28, height + 0.25, 0.035], [centerX, centerY, opening.planeZ - 0.13], new THREE.MeshPhongMaterial({color: 0x0f172a, transparent: true, opacity: 0.42}));
    });
    manifest.artifactSpawnPoints.forEach(function (point) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.16, 18), marker);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(point.x, 0.012, point.z);
      group.add(ring);
    });
    return group;
  }

  function ensureFieldLoader(THREE, callback, attempts) {
    if (THREE.GLTFLoader) return callback();
    if ((attempts || 0) > 30) return;
    global.setTimeout(function () { ensureFieldLoader(THREE, callback, (attempts || 0) + 1); }, 100);
  }

  function loadUploadedField(THREE, visual, procedural, manifest) {
    const browserAsset = manifest && manifest.asset && manifest.asset.browserAsset;
    if (!browserAsset) return;
    ensureFieldLoader(THREE, function () {
      const loader = new THREE.GLTFLoader();
      loader.load("./models/" + browserAsset, function (gltf) {
        if (!gltf || !gltf.scene) return;
        const field = gltf.scene;
        field.name = "decode-uploaded-field";
        const scale = manifest.scale;
        if (Array.isArray(scale)) field.scale.set(scale[0], scale[1], scale[2]);
        else field.scale.setScalar(Number(scale) || 1);
        const rotation = manifest.rotation || {x: 0, y: 0, z: 0};
        field.rotation.set(Number(rotation.x) || 0, Number(rotation.y) || 0, Number(rotation.z) || 0);
        const origin = manifest.origin || {x: 0, y: 0, z: 0};
        field.position.set(Number(origin.x) || 0, Number(origin.y) || 0, Number(origin.z) || 0);
        field.traverse(function (object) {
          if (!object.isMesh) return;
          object.receiveShadow = true;
          object.castShadow = false;
        });
        visual.add(field);
        procedural.visible = false;
        if (typeof global.setFieldVisible === "function") global.setFieldVisible(false);
      }, undefined, function (error) {
        console.warn("[DECODE field] Uploaded browser GLB could not be loaded; using procedural field.", error);
      });
    });
  }

  function mount(options) {
    const settings = options || {};
    const THREE = settings.THREE || global.THREE;
    const visual = settings.visual;
    const sceneContainer = document.getElementById("sim-scene-container");
    if (!THREE || !visual || !sceneContainer || !global.TelemarkDecodeGame) return null;
    installStyles();

    let manifest = global.TelemarkDecodeGame.defaultManifest;
    let selectedMode = global.TelemarkDecodeGame.modes.PRACTICE;
    let matchEndPending = false;
    let game = createGame();
    const proceduralField = createProceduralField(THREE, visual, manifest);
    const hud = createHud(sceneContainer, selectedMode);
    const artifactGroup = new THREE.Group();
    artifactGroup.name = "decode-artifacts";
    visual.add(artifactGroup);
    const artifacts = new Map();
    const artifactAlpha = (function () {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#000";
      [0.18, 0.39, 0.61, 0.82].forEach(function (vertical, row) {
        const count = row === 0 || row === 3 ? 5 : 7;
        for (let column = 0; column < count; column++) {
          const horizontal = (column + 0.5 + (row % 2) * 0.5) / count;
          context.beginPath();
          context.arc(horizontal * canvas.width, vertical * canvas.height, row === 0 || row === 3 ? 15 : 18, 0, Math.PI * 2);
          context.fill();
        }
      });
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.needsUpdate = true;
      return texture;
    })();
    const artifactMaterials = {
      purple: new THREE.MeshPhongMaterial({
        color: 0xb83bea,
        emissive: 0x3b0754,
        emissiveIntensity: 0.12,
        shininess: 45,
        alphaMap: artifactAlpha,
        alphaTest: 0.48,
        side: THREE.DoubleSide,
      }),
      green: new THREE.MeshPhongMaterial({
        color: 0x39c86a,
        emissive: 0x083d1b,
        emissiveIntensity: 0.1,
        shininess: 42,
        alphaMap: artifactAlpha,
        alphaTest: 0.48,
        side: THREE.DoubleSide,
      }),
    };
    const trajectoryMaterial = new THREE.LineBasicMaterial({color: 0x67e8f9, transparent: true, opacity: 0.72});
    let trajectory = null;

    function createGame() {
      return global.TelemarkDecodeGame.create({
        mode: selectedMode,
        manifest,
        onEnd: function (result) {
          if (matchEndPending) return;
          matchEndPending = true;
          if (typeof global.addHint === "function") {
            global.addHint(
              '<i class="fa-solid fa-flag-checkered"></i> Match complete: '
                + result.hits + " hits, " + result.misses + " misses, "
                + Math.round(result.accuracy * 100) + "% accuracy.",
              "info"
            );
          }
          global.setTimeout(function () {
            matchEndPending = false;
            if (typeof global._simIsRunning === "function" && global._simIsRunning()
                && typeof global._simHandleStop === "function") global._simHandleStop();
          }, 0);
        },
      });
    }

    function device(name) {
      return settings.hardwareMap && settings.hardwareMap._devices
        ? settings.hardwareMap._devices[name]
        : null;
    }

    function measuredMotor(name) {
      const motor = device(name);
      if (!motor) return {normalized: 0, measured: 0, target: 0};
      const measured = typeof motor.getVelocity === "function" ? Number(motor.getVelocity()) || 0 : 0;
      const normalized = measured / (2800 * 13 / 12);
      const target = motor._controlMode === "velocity"
        ? Number(motor._requestedVelocity) || 0
        : (Number(motor._requestedPower) || 0) * 2800;
      return {normalized, measured, target};
    }

    function hardwareSnapshot() {
      const intake = measuredMotor("intake");
      const transfer = measuredMotor("transfer");
      const launcher = device("launcher") ? measuredMotor("launcher") : measuredMotor("flywheel");
      const trigger = device("launcher_trigger") || device("trigger");
      return {
        intake: intake.normalized,
        transfer: transfer.normalized,
        flywheelVelocity: launcher.measured,
        flywheelTarget: launcher.target,
        triggerPosition: trigger && typeof trigger.getPosition === "function"
          ? Number(trigger.getPosition()) || 0
          : 0,
      };
    }

    function robotSnapshot() {
      const state = settings.motion && settings.motion.state || {};
      return {
        x: Number(state.x) || 0,
        z: Number(state.z) || 0,
        heading: Number(state.heading) || 0,
        velocityX: Number(state.velocityX) || 0,
        velocityZ: Number(state.velocityZ) || 0,
      };
    }

    function gamepadSnapshot() {
      return settings.getGamepad ? settings.getGamepad() : (global.gamepad || {});
    }

    function updateSensorFixtures(snapshot) {
      const intakeSensor = device("intake_sensor");
      const storageSensor = device("storage_sensor");
      const atIntake = snapshot.artifacts.some(function (artifact) { return artifact.state === "INTAKE"; });
      const storageFull = snapshot.controlledArtifacts >= 3;
      if (intakeSensor && typeof intakeSensor._setDistance === "function") intakeSensor._setDistance(atIntake ? 1.5 : 24);
      if (intakeSensor && typeof intakeSensor._setState === "function") intakeSensor._setState(!atIntake);
      if (storageSensor && typeof storageSensor._setDistance === "function") storageSensor._setDistance(storageFull ? 1.2 : 24);
      if (storageSensor && typeof storageSensor._setState === "function") storageSensor._setState(!storageFull);
    }

    function artifactMesh(artifact) {
      if (artifacts.has(artifact.id)) return artifacts.get(artifact.id);
      const group = new THREE.Group();
      group.name = "decode-artifact-" + artifact.id;
      const color = artifact.color === "green" ? "green" : "purple";
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.125, 32, 22), artifactMaterials[color]);
      shell.name = group.name + "-perforated-shell";
      shell.castShadow = true;
      shell.receiveShadow = true;
      group.add(shell);
      const seam = new THREE.Mesh(
        new THREE.TorusGeometry(0.124, 0.0028, 6, 48),
        new THREE.MeshPhongMaterial({color: color === "green" ? 0x208849 : 0x79209b, shininess: 25})
      );
      seam.name = group.name + "-seam";
      group.add(seam);
      artifactGroup.add(group);
      artifacts.set(artifact.id, group);
      return group;
    }

    function updateTrajectory(points) {
      if (!trajectory) {
        trajectory = new THREE.Line(new THREE.BufferGeometry(), trajectoryMaterial);
        trajectory.name = "decode-predicted-trajectory";
        visual.add(trajectory);
      }
      trajectory.visible = Boolean(points && points.length >= 2);
      if (!trajectory.visible) return;
      trajectory.geometry.setFromPoints(points.map(function (point) {
        return new THREE.Vector3(point.x, point.y, point.z);
      }));
    }

    function formatTime(snapshot) {
      if (snapshot.mode === "practice") return "Practice";
      const remaining = Math.max(0, Math.ceil(snapshot.timeRemaining));
      return Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0");
    }

    function updateHud(snapshot) {
      const feeding = snapshot.artifacts.find(function (artifact) { return artifact.state === "FEEDING"; });
      const intake = snapshot.artifacts.find(function (artifact) { return artifact.state === "INTAKE"; });
      let flow = snapshot.artifacts.some(function (artifact) { return artifact.state === "READY"; }) ? "stored" : "field";
      if (intake) {
        flow = "intake stage " + Math.min(3, Math.floor(intake.progress * 3) + 1)
          + " · " + Math.round(intake.progress * 100) + "%";
      }
      if (feeding) flow = "trigger lift · " + Math.round(feeding.progress * 100) + "%";
      const values = {
        time: formatTime(snapshot),
        score: snapshot.hits + " / " + snapshot.misses,
        accuracy: Math.round(snapshot.accuracy * 100) + "%",
        capacity: snapshot.controlledArtifacts + " / 3",
        supply: String(snapshot.fieldArtifacts),
        trajectory: snapshot.mode === "practice" ? "Shown" : "Hidden",
        target: String(Math.round(Math.abs(snapshot.hardware.flywheelTarget))),
        measured: String(Math.round(Math.abs(snapshot.hardware.flywheelVelocity))),
        trigger: Number(snapshot.hardware.triggerPosition || 0).toFixed(2),
        flow,
      };
      Object.keys(values).forEach(function (name) {
        const output = hud.element.querySelector('[data-decode-stat="' + name + '"]');
        if (output) output.textContent = values[name];
      });
    }

    function render(snapshot) {
      const visibleIds = new Set();
      snapshot.artifacts.forEach(function (artifact) {
        const mesh = artifactMesh(artifact);
        visibleIds.add(artifact.id);
        mesh.visible = artifact.state !== "SCORED" && artifact.state !== "MISSED";
        mesh.position.set(artifact.x, artifact.y, artifact.z);
        if (artifact.state === "FLIGHT") mesh.rotation.z += 0.12;
      });
      artifacts.forEach(function (mesh, id) { if (!visibleIds.has(id)) mesh.visible = false; });
      updateTrajectory(snapshot.predictedTrajectory);
      updateHud(snapshot);
      updateSensorFixtures(snapshot);
    }

    function reset(nextMode) {
      selectedMode = nextMode || selectedMode;
      hud.selectMode(selectedMode);
      matchEndPending = false;
      render(game.reset(selectedMode));
    }

    hud.element.addEventListener("click", function (event) {
      const button = event.target.closest && event.target.closest("[data-decode-mode]");
      if (!button) return;
      if (typeof global._simIsRunning === "function" && global._simIsRunning()
          && typeof global._simHandleStop === "function") global._simHandleStop();
      reset(button.dataset.decodeMode);
    });

    if (typeof global.fetch === "function") {
      global.fetch(MANIFEST_URL).then(function (response) {
        if (!response.ok) throw new Error("manifest returned " + response.status);
        return response.json();
      }).then(function (loadedManifest) {
        manifest = loadedManifest;
        const wasRunning = game.state.running;
        game = createGame();
        if (wasRunning) game.start();
        render(game.snapshot());
        loadUploadedField(THREE, visual, proceduralField, manifest);
      }).catch(function () {
        // The checked-in procedural metadata is optional at runtime. A missing
        // upload must never block the curriculum challenge.
      });
    }

    render(game.snapshot());
    return Object.freeze({
      initialize: function () { reset(selectedMode); },
      start: function () {
        game.setTriggerRestPosition(hardwareSnapshot().triggerPosition);
        render(game.start());
      },
      stop: function () { render(game.stop()); },
      update: function (seconds) {
        const snapshot = game.step(seconds, {
          robot: robotSnapshot(),
          hardware: hardwareSnapshot(),
          gamepad: gamepadSnapshot(),
        });
        render(snapshot);
        return snapshot;
      },
      reset,
      snapshot: function () { return game.snapshot(); },
      fieldManifest: function () { return manifest; },
    });
  }

  global.TelemarkDecodeGameView = Object.freeze({mount});
})(window);
