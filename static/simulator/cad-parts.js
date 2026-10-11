/**
 * Reusable, articulated FTC CAD mechanisms for Telemark lesson simulators.
 *
 * Assets are extracted from the credited full-robot models by
 * scripts/extract-cad-parts.cjs. Procedural robot stand-ins are hidden as soon
 * as mounting begins; failures surface an explicit accessible unavailable state.
 */
(function (global) {
  "use strict";

  const script = document.currentScript;
  const baseUrl = new URL("./models/parts/", script && script.src || global.location.href).href;
  const templates = new Map();
  let loaderPromise = null;

  const CATALOG = Object.freeze({
    "decode-drivetrain": {file: "decode-drivetrain.glb", fit: 2.1, type: "drivetrain"},
    "quixilver-drivetrain": {file: "quixilver-drivetrain.glb", fit: 2.1, type: "drivetrain", rotation: [Math.PI / 2, 0, 0]},
    "manning-2025-drivetrain": {file: "manning-2025-drivetrain.glb", fit: 2.1, type: "drivetrain", rotation: [-Math.PI / 2, 0, 0]},
    "centerstage-drivetrain": {file: "centerstage-drivetrain.glb", fit: 2.1, type: "drivetrain", rotation: [-Math.PI / 2, 0, 0]},
    "inputoutput-drivetrain": {file: "inputoutput-drivetrain.glb", fit: 2.1, type: "drivetrain"},
    "skystone-drivetrain": {file: "skystone-drivetrain.glb", fit: 2.1, type: "drivetrain", rotation: [-Math.PI / 2, 0, 0]},
    "decode-intake": {file: "decode-intake.glb", fit: 1.5, type: "spinner", direction: -1, mouthFace: "max-z"},
    "decode-transfer": {file: "decode-transfer.glb", fit: 1.1, type: "spinner"},
    "decode-flywheel": {file: "decode-flywheel.glb", fit: 1.15, type: "spinner"},
    "decode-trigger": {file: "decode-trigger.glb", fit: 0.9, type: "hinge"},
    "centerstage-intake": {file: "centerstage-intake.glb", fit: 1.5, type: "hinge", rotation: [-Math.PI / 2, 0, 0]},
    "quixilver-slide": {file: "quixilver-slide.glb", fit: 1.65, type: "slide", rotation: [Math.PI / 2, 0, 0]},
    "quixilver-claw": {file: "quixilver-claw.glb", fit: 1.25, type: "claw", rotation: [Math.PI / 2, 0, 0]},
    "quixilver-arm": {file: "quixilver-arm.glb", fit: 1.55, type: "arm", rotation: [Math.PI / 2, 0, 0]},
    "inputoutput-arm": {file: "inputoutput-arm.glb", fit: 1.55, type: "arm"},
    "skystone-lift": {file: "skystone-lift.glb", fit: 1.7, type: "skystone-lift", rotation: [-Math.PI / 2, 0, 0]},
    "roverruckus-drivetrain": {file: "roverruckus-drivetrain.glb", fit: 2.1, type: "drivetrain", rotation: [-Math.PI / 2, 0, 0]},
    "roverruckus-intake": {file: "roverruckus-intake.glb", fit: 1.65, type: "spinner", rotation: [-Math.PI / 2, 0, 0]},
    "roverruckus-lift": {file: "roverruckus-lift.glb", fit: 1.7, type: "rover-lift", rotation: [-Math.PI / 2, 0, 0]},
    "roverruckus-hang": {file: "roverruckus-hang.glb", fit: 1.55, type: "static", rotation: [-Math.PI / 2, 0, 0]}
  });

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
  }

  function toArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }

  function setVisible(targets, visible) {
    toArray(targets).forEach(function (target) {
      if (!target) return;
      target.visible = visible;
      if (!visible && target.parent && typeof target.parent.remove === "function") {
        target.parent.remove(target);
      }
    });
  }

  function reportUnavailable(key, settings, error) {
    const doc = typeof document !== "undefined" ? document : null;
    if (!doc || typeof doc.createElement !== "function") return null;
    const rendererElement = global.renderer && global.renderer.domElement;
    const host = settings.overlayHost
      || rendererElement && rendererElement.parentElement
      || doc.getElementById && (
        doc.getElementById("sim-scene-container")
        || doc.getElementById("scene-container")
        || doc.getElementById("scene-wrap")
      );
    if (!host || typeof host.appendChild !== "function") return null;
    const identifier = "telemark-cad-unavailable-" + key;
    const previous = doc.getElementById && doc.getElementById(identifier);
    if (previous) return previous;
    const notice = doc.createElement("div");
    notice.id = identifier;
    notice.className = "sim-cad-unavailable";
    notice.setAttribute("role", "status");
    notice.textContent = "CAD model unavailable: " + key.replace(/-/g, " ") + ".";
    if (error && error.message) notice.title = error.message;
    host.appendChild(notice);
    return notice;
  }

  function ensureLoader(THREE) {
    if (THREE.GLTFLoader) return Promise.resolve(THREE.GLTFLoader);
    if (loaderPromise) return loaderPromise;
    loaderPromise = new Promise(function (resolve, reject) {
      let loaderScript = document.querySelector("script[data-telemark-cad-parts-loader]");
      if (!loaderScript) {
        loaderScript = document.createElement("script");
        const revision = String(THREE.REVISION || "128").replace(/[^0-9]/g, "") || "128";
        loaderScript.src = "https://cdn.jsdelivr.net/npm/three@0." + revision + ".0/examples/js/loaders/GLTFLoader.js";
        loaderScript.dataset.telemarkCadPartsLoader = "true";
        document.head.appendChild(loaderScript);
      }
      function loaded() {
        if (THREE.GLTFLoader) resolve(THREE.GLTFLoader);
        else reject(new Error("The GLB loader did not initialize."));
      }
      if (THREE.GLTFLoader) {
        loaded();
        return;
      }
      loaderScript.addEventListener("load", loaded, {once: true});
      loaderScript.addEventListener("error", function () {
        reject(new Error("The GLB loader could not be downloaded."));
      }, {once: true});
    });
    return loaderPromise;
  }

  function loadTemplate(THREE, key, entry) {
    if (templates.has(key)) return templates.get(key);
    const pending = ensureLoader(THREE).then(function () {
      return new Promise(function (resolve, reject) {
        new THREE.GLTFLoader().load(
          new URL(entry.file, baseUrl).href,
          function (gltf) {
            if (!gltf || !gltf.scene) {
              reject(new Error(entry.file + " did not contain a scene."));
              return;
            }
            resolve(gltf.scene);
          },
          undefined,
          reject
        );
      });
    });
    templates.set(key, pending);
    return pending;
  }

  function pointFromMetadata(THREE, part, key) {
    const raw = part && part.userData && part.userData[key];
    if (!Array.isArray(raw) || raw.length !== 3) return null;
    part.updateWorldMatrix(true, false);
    return part.localToWorld(new THREE.Vector3(raw[0], raw[1], raw[2]));
  }

  function partCenter(THREE, part) {
    const explicit = pointFromMetadata(THREE, part, "telemarkCadPivot");
    if (explicit) return explicit;
    const fractions = part && part.userData && part.userData.telemarkCadPivotFractions;
    if (Array.isArray(fractions) && fractions.length === 3) {
      const bounds = new THREE.Box3().setFromObject(part);
      return new THREE.Vector3(
        THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, clamp(fractions[0], 0, 1)),
        THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, clamp(fractions[1], 0, 1)),
        THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, clamp(fractions[2], 0, 1))
      );
    }
    return pointFromMetadata(THREE, part, "telemarkCadCenter")
      || new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3());
  }

  function motionAxis(part, fallback) {
    const declared = part && part.userData && part.userData.telemarkCadAxis;
    if (declared && declared !== "auto") return declared;
    return part && part.userData && part.userData.spinAxis || fallback || "x";
  }

  function pivotPart(THREE, part) {
    if (!part || !part.parent) return null;
    const parent = part.parent;
    const center = partCenter(THREE, part);
    const pivot = new THREE.Group();
    pivot.name = part.name + "-physical-pivot";
    parent.add(pivot);
    pivot.position.copy(parent.worldToLocal(center.clone()));
    parent.updateMatrixWorld(true);
    pivot.attach(part);
    return {
      object: pivot,
      part: part,
      rest: pivot.position.clone(),
      axis: motionAxis(part, "x"),
      minimum: Number.isFinite(Number(part.userData.telemarkCadMin)) ? Number(part.userData.telemarkCadMin) : 0,
      maximum: Number.isFinite(Number(part.userData.telemarkCadMax)) ? Number(part.userData.telemarkCadMax) : 1
    };
  }

  function travelPart(THREE, part) {
    if (!part || !part.parent) return null;
    const parent = part.parent;
    const travel = new THREE.Group();
    travel.name = part.name + "-bounded-travel";
    parent.add(travel);
    parent.updateMatrixWorld(true);
    travel.attach(part);
    return {
      object: travel,
      part: part,
      rest: travel.position.clone(),
      axis: motionAxis(part, "x"),
      minimum: Number.isFinite(Number(part.userData.telemarkCadMin)) ? Number(part.userData.telemarkCadMin) : 0,
      maximum: Number.isFinite(Number(part.userData.telemarkCadMax)) ? Number(part.userData.telemarkCadMax) : 0.42
    };
  }

  function wrapAtWorldPoint(THREE, object, point, suffix) {
    if (!object || !object.parent) return null;
    const parent = object.parent;
    const wrapper = new THREE.Group();
    wrapper.name = object.name + "-" + suffix;
    parent.add(wrapper);
    parent.updateWorldMatrix(true, false);
    wrapper.position.copy(parent.worldToLocal(point.clone()));
    parent.updateMatrixWorld(true);
    wrapper.attach(object);
    return {
      object: wrapper,
      part: object,
      rest: wrapper.position.clone(),
      restRotation: wrapper.rotation.clone()
    };
  }

  /**
   * Articulate the paired Quixilver scissor assemblies instead of sliding the
   * complete CAD mesh sideways. Each real linkage rotates around its source
   * pivot while the joint hardware follows the expanding X geometry. The
   * motor stays fixed to the base, and a separate carriage marker provides a
   * stable moving anchor for anything mounted to the end of the slide.
   */
  function scissorSlidePart(THREE, model, part) {
    if (!part || part.userData.telemarkCadMotion !== "scissor") return null;
    const assemblies = nodesWith(part, function (object) {
      return /Horizontal(?:_|\s)+Slides(?:_|\s)+Linkage(?:_|\s)+Assembly/i.test(object.name || "");
    });
    if (!assemblies.length) return null;

    const travelMinimum = Number.isFinite(Number(part.userData.telemarkCadMin))
      ? Number(part.userData.telemarkCadMin) : 0;
    const travelMaximum = Number.isFinite(Number(part.userData.telemarkCadMax))
      ? Number(part.userData.telemarkCadMax) : 0.29;
    const assemblyRigs = assemblies.map(function (assembly) {
      assembly.updateWorldMatrix(true, true);
      const bounds = boundsRelativeTo(THREE, assembly, assembly);
      const plans = assembly.children.slice().map(function (component) {
        const name = component.name || "";
        const isLink = /Intake(?:_|\s)+Pivot(?:_|\s)+Linkage/i.test(name);
        const staysOnBase = /Axon(?:_|\s)+MAX/i.test(name);
        const worldCenter = new THREE.Box3().setFromObject(component).getCenter(new THREE.Vector3());
        const worldOrigin = component.getWorldPosition(new THREE.Vector3());
        const localCenter = assembly.worldToLocal(worldCenter.clone());
        const localOrigin = assembly.worldToLocal(worldOrigin.clone());
        return {
          component: component,
          isLink: isLink,
          staysOnBase: staysOnBase,
          point: isLink ? worldOrigin : worldCenter,
          vector: localCenter.sub(localOrigin)
        };
      });

      const entries = plans.filter(function (plan) { return !plan.staysOnBase; }).map(function (plan) {
        const wrapped = wrapAtWorldPoint(
          THREE,
          plan.component,
          plan.point,
          plan.isLink ? "scissor-pivot" : "scissor-joint"
        );
        if (!wrapped) return null;
        wrapped.isLink = plan.isLink;
        wrapped.vector = plan.vector;
        return wrapped;
      }).filter(Boolean);
      const referenceLink = entries.filter(function (entry) {
        return entry.isLink && Math.abs(entry.vector.z) > 1e-5;
      }).sort(function (left, right) {
        return right.vector.lengthSq() - left.vector.lengthSq();
      })[0] || null;

      return {
        entries: entries,
        baseX: bounds.min.x,
        centerZ: bounds.getCenter(new THREE.Vector3()).z,
        width: Math.max(bounds.max.x - bounds.min.x, 1e-5),
        referenceLink: referenceLink
      };
    });

    const partBounds = boundsRelativeTo(THREE, part, model);
    const partCenter = partBounds.getCenter(new THREE.Vector3());
    const carriage = new THREE.Group();
    carriage.name = "telemark-cad-slide-carriage";
    carriage.position.set(partBounds.max.x, partCenter.y, partCenter.z);
    model.add(carriage);
    const carriageRest = carriage.position.clone();

    return {
      object: carriage,
      rest: carriageRest,
      axis: motionAxis(part, "x"),
      minimum: travelMinimum,
      maximum: travelMaximum,
      assemblies: assemblyRigs,
      setProgress: function (progress) {
        const travel = THREE.MathUtils.lerp(travelMinimum, travelMaximum, clamp(progress, 0, 1));
        assemblyRigs.forEach(function (assemblyRig) {
          const extensionScale = (assemblyRig.width + travel) / assemblyRig.width;
          let crossScale = Math.max(0.34, 1 - clamp(progress, 0, 1) * 0.62);
          const reference = assemblyRig.referenceLink;
          if (reference) {
            const halfX = Math.abs(reference.vector.x);
            const halfZ = Math.abs(reference.vector.z);
            const halfLength = Math.hypot(halfX, halfZ);
            const nextHalfX = halfX + travel / 6;
            if (halfZ > 1e-5 && nextHalfX < halfLength) {
              crossScale = Math.max(0.34, Math.sqrt(halfLength * halfLength - nextHalfX * nextHalfX) / halfZ);
            }
          }

          assemblyRig.entries.forEach(function (entry) {
            entry.object.position.copy(entry.rest);
            entry.object.position.x = assemblyRig.baseX
              + (entry.rest.x - assemblyRig.baseX) * extensionScale;
            entry.object.position.z = assemblyRig.centerZ
              + (entry.rest.z - assemblyRig.centerZ) * crossScale;
            entry.object.rotation.copy(entry.restRotation);
            if (!entry.isLink) return;
            const restAngle = Math.atan2(entry.vector.z, entry.vector.x);
            const nextAngle = Math.atan2(
              entry.vector.z * crossScale,
              entry.vector.x * extensionScale
            );
            // Three.js positive Y rotation turns +X toward -Z.
            entry.object.rotation.y -= nextAngle - restAngle;
          });
        });
        carriage.position.copy(carriageRest);
        carriage.position.x += travel;
      }
    };
  }

  function named(model, name) {
    return model.getObjectByName && model.getObjectByName(name);
  }

  function nodesWith(model, predicate) {
    const found = [];
    model.traverse(function (object) {
      if (predicate(object)) found.push(object);
    });
    return found;
  }

  function firstMovable(model) {
    return nodesWith(model, function (object) {
      return object.name === "telemark-cad-mechanism"
        || object.userData.telemarkCadAxis
        || object.userData.spinAxis;
    })[0] || null;
  }

  function createRig(THREE, type, model, entry) {
    const controller = {
      model: model,
      progress: 0,
      power: 0,
      setProgress: function (value) { this.progress = clamp(value, 0, 1); },
      setPower: function (value) { this.power = clamp(value, -1, 1); },
      setAngle: function (value) { this.angle = Number(value) || 0; },
      setWheelAngles: function () {},
      update: function () {}
    };

    if (type === "claw") {
      const left = pivotPart(THREE, named(model, "telemark-cad-claw-left"));
      const right = pivotPart(THREE, named(model, "telemark-cad-claw-right"));
      function clawPose(entry, key, fallback) {
        const value = entry && entry.part && entry.part.userData && entry.part.userData[key];
        return Number.isFinite(Number(value)) ? Number(value) : fallback;
      }
      function openAngle(entry) {
        return clawPose(entry, "telemarkCadOpen", clamp(0, entry.minimum, entry.maximum));
      }
      function closedAngle(entry) {
        const fartherLimit = Math.abs(entry.minimum) > Math.abs(entry.maximum) ? entry.minimum : entry.maximum;
        return clawPose(entry, "telemarkCadClosed", fartherLimit);
      }
      controller.setFingerProgress = function (leftValue, rightValue) {
        const leftProgress = clamp(leftValue, 0, 1);
        const rightProgress = clamp(rightValue, 0, 1);
        this.progress = (leftProgress + rightProgress) * 0.5;
        if (left) left.object.rotation[left.axis] = THREE.MathUtils.lerp(openAngle(left), closedAngle(left), leftProgress);
        if (right) right.object.rotation[right.axis] = THREE.MathUtils.lerp(openAngle(right), closedAngle(right), rightProgress);
      };
      controller.setProgress = function (value) {
        const progress = clamp(value, 0, 1);
        this.setFingerProgress(progress, progress);
      };
      controller.setProgress(0);
      return controller;
    }

    if (type === "slide") {
      const part = named(model, "telemark-cad-mechanism") || firstMovable(model);
      const scissor = scissorSlidePart(THREE, model, part);
      const travel = scissor || travelPart(THREE, part);
      controller._motionObject = travel && travel.object;
      controller._articulation = scissor ? "scissor" : "linear";
      controller.setProgress = function (value) {
        this.progress = clamp(value, 0, 1);
        if (!travel) return;
        if (scissor) {
          scissor.setProgress(this.progress);
          return;
        }
        travel.object.position.copy(travel.rest);
        travel.object.position[travel.axis] += THREE.MathUtils.lerp(travel.minimum, travel.maximum, this.progress);
      };
      controller.setProgress(0);
      return controller;
    }

    if (type === "arm" || type === "hinge") {
      const part = named(model, "telemark-cad-arm")
        || named(model, "telemark-cad-trigger")
        || named(model, "telemark-cad-mechanism")
        || firstMovable(model);
      const hinge = pivotPart(THREE, part);
      controller._motionObject = hinge && hinge.object;
      controller.setProgress = function (value) {
        this.progress = clamp(value, 0, 1);
        if (hinge) hinge.object.rotation[hinge.axis] = THREE.MathUtils.lerp(hinge.minimum, hinge.maximum, this.progress);
      };
      controller.setAngle = function (value) {
        if (!hinge) return;
        hinge.object.rotation[hinge.axis] = clamp(value, hinge.minimum, hinge.maximum);
        this.progress = hinge.maximum === hinge.minimum ? 0 : (hinge.object.rotation[hinge.axis] - hinge.minimum) / (hinge.maximum - hinge.minimum);
      };
      controller.setProgress(0);
      return controller;
    }

    if (type === "spinner") {
      const direction = Number(entry && entry.direction) || 1;
      const spinners = nodesWith(model, function (object) {
        return /^telemark-cad-(?:intake-stage-\d|transfer|flywheel)$/.test(object.name)
          || object.userData.telemarkCadMotion === "spin";
      }).map(function (part) { return pivotPart(THREE, part); }).filter(Boolean);
      if (!spinners.length) {
        const spinner = pivotPart(THREE, firstMovable(model));
        if (spinner) spinners.push(spinner);
      }
      controller.update = function (dt) {
        const step = this.power * direction * clamp(dt, 0, 0.05) * 9;
        spinners.forEach(function (spinner) {
          spinner.object.rotation[spinner.axis] += step;
        });
      };
      return controller;
    }

    if (type === "drivetrain") {
      const order = ["left-front", "left-back", "right-front", "right-back"];
      const wheels = order.map(function (wheelName) {
        return pivotPart(THREE, named(model, "telemark-cad-wheel-" + wheelName));
      });
      controller.setWheelAngles = function (angles) {
        wheels.forEach(function (wheel, index) {
          if (wheel && Number.isFinite(Number(angles[index]))) wheel.object.rotation[wheel.axis] = Number(angles[index]);
        });
      };
      return controller;
    }

    if (type === "skystone-lift") {
      const lowerLow = pivotPart(THREE, named(model, "telemark-cad-lift-lower-low"));
      const lowerHigh = pivotPart(THREE, named(model, "telemark-cad-lift-lower-high"));
      const upperLow = pivotPart(THREE, named(model, "telemark-cad-lift-upper-low"));
      const upperHigh = pivotPart(THREE, named(model, "telemark-cad-lift-upper-high"));
      const middle = travelPart(THREE, named(model, "telemark-cad-lift-middle"));
      const carriage = travelPart(THREE, named(model, "telemark-cad-lift-carriage"));
      controller._motionObject = carriage && carriage.object;
      const upper = [upperLow, upperHigh].filter(Boolean);
      const lower = [lowerLow, lowerHigh].filter(Boolean);
      const restingAngle = 0.32;
      const deployedAngle = 1.32;
      controller.setProgress = function (value) {
        this.progress = clamp(value, 0, 1);
        const angle = THREE.MathUtils.lerp(restingAngle, deployedAngle, this.progress);
        const delta = angle - restingAngle;
        const linkLength = 0.441;
        const baseMidpoint = {x: -0.2, z: 0.2685};
        const middleRest = {x: 0.2195, z: 0.408};
        const middleNow = {
          x: baseMidpoint.x + linkLength * Math.cos(angle),
          z: baseMidpoint.z + linkLength * Math.sin(angle)
        };
        const middleDelta = {
          x: middleNow.x - middleRest.x,
          z: middleNow.z - middleRest.z
        };
        const upperAnchorRest = {x: 0.2195, z: 0.306};
        const topRest = {x: -0.2, z: 0.4455};
        const upperAngle = Math.PI - angle;
        const topNow = {
          x: upperAnchorRest.x + middleDelta.x + linkLength * Math.cos(upperAngle),
          z: upperAnchorRest.z + middleDelta.z + linkLength * Math.sin(upperAngle)
        };
        const topDelta = {x: topNow.x - topRest.x, z: topNow.z - topRest.z};

        lower.forEach(function (entry) {
          entry.object.rotation.y = -delta;
        });
        upper.forEach(function (entry) {
          entry.object.rotation.y = delta;
          entry.object.position.copy(entry.rest);
          entry.object.position.x += middleDelta.x;
          entry.object.position.z += middleDelta.z;
        });
        if (middle) {
          middle.object.position.copy(middle.rest);
          middle.object.position.x += middleDelta.x;
          middle.object.position.z += middleDelta.z;
        }
        if (carriage) {
          carriage.object.position.copy(carriage.rest);
          carriage.object.position.x += topDelta.x;
          carriage.object.position.z += topDelta.z;
        }
      };
      controller.setProgress(0);
      return controller;
    }

    if (type === "rover-lift") {
      const stages = [1, 2, 3].map(function (stage) {
        return travelPart(THREE, named(model, "telemark-cad-rover-lift-stage-" + stage));
      }).filter(Boolean);
      const carriage = travelPart(THREE, named(model, "telemark-cad-rover-lift-carriage"));
      const movingParts = stages.concat(carriage ? [carriage] : []);
      controller._motionObject = carriage && carriage.object;
      controller._articulation = "telescoping";
      controller.setProgress = function (value) {
        this.progress = clamp(value, 0, 1);
        movingParts.forEach(function (moving) {
          moving.object.position.copy(moving.rest);
          moving.object.position[moving.axis] += THREE.MathUtils.lerp(
            moving.minimum,
            moving.maximum,
            controller.progress
          );
        });
      };
      controller.setProgress(0);
      return controller;
    }

    return controller;
  }

  function boundsRelativeTo(THREE, object, space) {
    object.updateWorldMatrix(true, true);
    space.updateWorldMatrix(true, false);
    const worldBounds = new THREE.Box3().setFromObject(object);
    const localBounds = new THREE.Box3();
    localBounds.makeEmpty();
    [worldBounds.min.x, worldBounds.max.x].forEach(function (x) {
      [worldBounds.min.y, worldBounds.max.y].forEach(function (y) {
        [worldBounds.min.z, worldBounds.max.z].forEach(function (z) {
          localBounds.expandByPoint(space.worldToLocal(new THREE.Vector3(x, y, z)));
        });
      });
    });
    return localBounds;
  }

  function pointInRoot(THREE, root, object) {
    object.updateWorldMatrix(true, false);
    root.updateWorldMatrix(true, false);
    return root.worldToLocal(object.getWorldPosition(new THREE.Vector3()));
  }

  function addAnchor(THREE, root, parent, name, rootPosition) {
    const anchor = new THREE.Group();
    anchor.name = "telemark-cad-anchor-" + name;
    const worldPosition = root.localToWorld(rootPosition.clone());
    anchor.position.copy(parent.worldToLocal(worldPosition));
    anchor.userData.telemarkCadAnchor = name;
    parent.add(anchor);
    return anchor;
  }

  function farthestFacePoint(THREE, bounds, origin) {
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const axes = ["x", "y", "z"];
    const axis = axes.sort(function (left, right) { return size[right] - size[left]; })[0];
    const minimumDistance = Math.abs(origin[axis] - bounds.min[axis]);
    const maximumDistance = Math.abs(origin[axis] - bounds.max[axis]);
    center[axis] = minimumDistance > maximumDistance ? bounds.min[axis] : bounds.max[axis];
    return center;
  }

  function installAnchors(THREE, rig, entry) {
    const root = rig.root;
    const bounds = boundsRelativeTo(THREE, rig.normalized, root);
    const center = bounds.getCenter(new THREE.Vector3());
    const anchors = {};
    function fixed(name, point) {
      anchors[name] = addAnchor(THREE, root, root, name, point);
    }

    fixed("center", center.clone());
    fixed("top", new THREE.Vector3(center.x, bounds.max.y, center.z));
    fixed("bottom", new THREE.Vector3(center.x, bounds.min.y, center.z));
    fixed("front", new THREE.Vector3(center.x, center.y, bounds.min.z));
    fixed("back", new THREE.Vector3(center.x, center.y, bounds.max.z));
    fixed("top_front", new THREE.Vector3(center.x, bounds.max.y, bounds.min.z));

    if (entry.type === "drivetrain") {
      fixed("mechanism_mount", new THREE.Vector3(center.x, bounds.max.y, center.z));
      fixed("camera_mount", new THREE.Vector3(center.x, bounds.max.y, bounds.min.z));
      fixed("sensor_mount", new THREE.Vector3(center.x, bounds.max.y, bounds.min.z));
    } else if (entry.type === "claw") {
      const left = named(rig.model, "telemark-cad-claw-left-physical-pivot");
      const right = named(rig.model, "telemark-cad-claw-right-physical-pivot");
      let mountPoint = new THREE.Vector3(center.x, center.y, bounds.max.z);
      if (left && right) {
        mountPoint = pointInRoot(THREE, root, left).add(pointInRoot(THREE, root, right)).multiplyScalar(0.5);
      }
      fixed("mount", mountPoint);
      fixed("grip", farthestFacePoint(THREE, bounds, mountPoint));
    } else if (entry.type === "arm" || entry.type === "hinge") {
      const motionParent = rig._motionObject || root;
      const origin = pointInRoot(THREE, root, motionParent);
      anchors.tool_mount = addAnchor(
        THREE,
        root,
        motionParent,
        "tool_mount",
        farthestFacePoint(THREE, bounds, origin)
      );
      fixed("mount", origin);
    } else if (entry.type === "slide" || entry.type === "skystone-lift" || entry.type === "rover-lift") {
      const motionParent = rig._motionObject || root;
      anchors.carriage = addAnchor(THREE, root, motionParent, "carriage", center.clone());
      fixed("mount", new THREE.Vector3(center.x, bounds.min.y, center.z));
    } else {
      const mouthAtMaximum = entry.mouthFace === "max-z";
      fixed("mount", new THREE.Vector3(center.x, center.y, mouthAtMaximum ? bounds.min.z : bounds.max.z));
      fixed("mouth", new THREE.Vector3(center.x, center.y, mouthAtMaximum ? bounds.max.z : bounds.min.z));
    }

    rig.anchors = anchors;
    rig.getAnchor = function (name) { return anchors[String(name)] || null; };
    rig.getBounds = function (space) {
      return space === "world"
        ? new THREE.Box3().setFromObject(rig.normalized)
        : bounds.clone();
    };
    rig.follow = function (object, anchorName, options) {
      return follow(THREE, rig, anchorName, object, options);
    };
    rig.dock = function (childRig, options) {
      const settings = options || {};
      return dock(
        THREE,
        rig,
        settings.parentAnchor || "tool_mount",
        childRig,
        settings.childAnchor || "mount",
        settings
      );
    };
  }

  function follow(THREE, rig, anchorName, object, options) {
    const anchor = rig && rig.getAnchor && rig.getAnchor(anchorName);
    if (!anchor || !object) return false;
    const settings = options || {};
    anchor.add(object);
    const offset = settings.offset || [0, 0, 0];
    object.position.set(offset[0] || 0, offset[1] || 0, offset[2] || 0);
    if (settings.rotation) object.rotation.set(settings.rotation[0], settings.rotation[1], settings.rotation[2]);
    return true;
  }

  function dock(THREE, parentRig, parentAnchorName, childRig, childAnchorName, options) {
    const parentAnchor = parentRig && parentRig.getAnchor && parentRig.getAnchor(parentAnchorName);
    const childAnchor = childRig && childRig.getAnchor && childRig.getAnchor(childAnchorName);
    const childRoot = childRig && childRig.root;
    if (!parentAnchor || !childAnchor || !childRoot) return false;
    const settings = options || {};
    parentAnchor.attach(childRoot);
    if (settings.rotation) childRoot.rotation.set(settings.rotation[0], settings.rotation[1], settings.rotation[2]);
    parentAnchor.updateWorldMatrix(true, false);
    childRoot.updateWorldMatrix(true, true);
    const parentPosition = parentAnchor.getWorldPosition(new THREE.Vector3());
    const childPosition = childAnchor.getWorldPosition(new THREE.Vector3());
    const rootPosition = childRoot.getWorldPosition(new THREE.Vector3());
    const offset = settings.offset || [0, 0, 0];
    if (offset[0] || offset[1] || offset[2]) {
      const offsetWorld = new THREE.Vector3(offset[0] || 0, offset[1] || 0, offset[2] || 0);
      offsetWorld.applyQuaternion(parentAnchor.getWorldQuaternion(new THREE.Quaternion()));
      parentPosition.add(offsetWorld);
    }
    const targetRootPosition = rootPosition.add(parentPosition.sub(childPosition));
    childRoot.position.copy(childRoot.parent.worldToLocal(targetRootPosition));
    childRoot.updateWorldMatrix(true, true);
    return true;
  }

  function normalize(THREE, model, entry, options) {
    const sourceFrame = new THREE.Group();
    const rotation = options.sourceRotation || entry.rotation || [0, 0, 0];
    sourceFrame.rotation.set(rotation[0], rotation[1], rotation[2]);
    sourceFrame.add(model);
    sourceFrame.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(sourceFrame);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    sourceFrame.position.set(-center.x, -bounds.min.y, -center.z);

    const scaleFrame = new THREE.Group();
    scaleFrame.name = "telemark-cad-part-normalized";
    const fit = Number(options.fit || entry.fit || 1);
    const extent = Math.max(size.x, size.y, size.z) || 1;
    scaleFrame.scale.setScalar(fit / extent);
    scaleFrame.add(sourceFrame);
    return scaleFrame;
  }

  function mount(key, options) {
    const settings = options || {};
    const THREE = settings.THREE || global.THREE;
    const entry = CATALOG[key];
    if (!THREE) return Promise.reject(new Error("THREE is required to mount CAD parts."));
    if (!entry) return Promise.reject(new Error("Unknown Telemark CAD part: " + key));
    const parent = settings.parent || settings.scene || global.scene;
    if (!parent || !parent.add) return Promise.reject(new Error("A Three.js parent or scene is required."));

    // Never render the old block/procedural robot, including while the real
    // CAD request is in flight. A load failure gets an explicit UI state.
    setVisible(settings.fallback, false);

    const root = new THREE.Group();
    root.name = "telemark-cad-part-" + key;
    const position = settings.position || [0, 0, 0];
    const rotation = settings.rotation || [0, 0, 0];
    root.position.set(position[0], position[1], position[2]);
    root.rotation.set(rotation[0], rotation[1], rotation[2]);
    parent.add(root);

    return loadTemplate(THREE, key, entry).then(function (template) {
      const model = template.clone(true);
      model.traverse(function (object) {
        if (!object.isMesh) return;
        object.castShadow = settings.castShadow !== false;
        object.receiveShadow = Boolean(settings.receiveShadow);
      });
      const rig = createRig(THREE, entry.type, model, entry);
      const normalized = normalize(THREE, model, entry, settings);
      root.add(normalized);
      rig.root = root;
      rig.normalized = normalized;
      rig.key = key;
      installAnchors(THREE, rig, entry);
      if (typeof settings.onReady === "function") settings.onReady(rig);
      return rig;
    }).catch(function (error) {
      parent.remove(root);
      reportUnavailable(key, settings, error);
      if (typeof settings.onError === "function") settings.onError(error);
      else console.warn("[Telemark CAD parts] " + key + " could not be loaded.", error);
      throw error;
    });
  }

  global.TelemarkCadParts = Object.freeze({
    catalog: CATALOG,
    mount: mount,
    dock: function (parentRig, parentAnchorName, childRig, childAnchorName, options) {
      const THREE = options && options.THREE || global.THREE;
      if (!THREE) return false;
      return dock(THREE, parentRig, parentAnchorName, childRig, childAnchorName, options);
    },
    preload: function (key) {
      const THREE = global.THREE;
      const entry = CATALOG[key];
      if (!THREE || !entry) return Promise.reject(new Error("Unknown or unavailable CAD part: " + key));
      return loadTemplate(THREE, key, entry);
    }
  });
})(window);
