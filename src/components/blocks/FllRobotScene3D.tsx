import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {FllPlaybackFrame, FllSceneState} from '@site/src/telemark/blocks/fllInterpreter';
import styles from './FllRobotScene3D.module.css';

interface Props {
  scene: FllSceneState;
  trail: FllSceneState[];
  frame: FllPlaybackFrame | null;
  currentStep: number;
  totalSteps: number;
  playing: boolean;
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function brickMesh(size: [number, number, number], color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({color, roughness: 0.72}));
}

export default function FllRobotScene3D({scene, trail, frame, currentStep, totalSteps, playing}: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const robotRef = useRef<THREE.Group | null>(null);
  const armRef = useRef<THREE.Group | null>(null);
  const objectRef = useRef<THREE.Mesh | null>(null);
  const trailRef = useRef<THREE.Line | null>(null);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
    } catch {
      setWebglError(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const world = new THREE.Scene();
    world.background = new THREE.Color(0x07111a);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);
    camera.position.set(150, 170, 170);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.minDistance = 90;
    controls.maxDistance = 430;
    controls.maxPolarAngle = Math.PI * 0.48;

    world.add(new THREE.HemisphereLight(0xe7f7ff, 0x17202b, 2.0));
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    sun.position.set(-80, 160, 100);
    sun.castShadow = true;
    world.add(sun);

    const mat = brickMesh([236, 2, 108], 0x263746);
    mat.position.y = -1.5;
    mat.receiveShadow = true;
    world.add(mat);
    const home = brickMesh([34, 0.4, 28], 0x2b6d91);
    home.position.set(-100, 0, 38);
    world.add(home);
    const delivery = brickMesh([34, 0.5, 32], 0x2c7b4a);
    delivery.position.set(78, 0, -28);
    world.add(delivery);
    const line = brickMesh([3, 0.4, 106], 0x111111);
    line.position.set(-20, 0.2, 0);
    world.add(line);
    const obstacle = brickMesh([24, 16, 24], 0xe59035);
    obstacle.position.set(20, 8, 0);
    obstacle.castShadow = true;
    world.add(obstacle);
    const target = brickMesh([9, 18, 18], 0xd9b62e);
    target.position.set(38, 9, 36);
    world.add(target);
    const cargo = brickMesh([10, 10, 10], 0xb95063);
    cargo.castShadow = true;
    objectRef.current = cargo;
    world.add(cargo);
    const wallMaterial = new THREE.MeshStandardMaterial({color: 0xc6d0d8, roughness: 0.7});
    [[236, 8, 3, 0, 3, -55], [236, 8, 3, 0, 3, 55], [3, 8, 108, -119, 3, 0], [3, 8, 108, 119, 3, 0]].forEach(([w, h, d, x, y, z]) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMaterial);
      wall.position.set(x, y, z); world.add(wall);
    });

    const robot = new THREE.Group();
    const base = brickMesh([22, 7, 18], 0xe3e8eb); base.position.y = 6; base.castShadow = true; robot.add(base);
    const hub = brickMesh([12, 6, 12], 0x5b6570); hub.position.y = 12; robot.add(hub);
    [-8, 8].forEach((z) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 3, 24), new THREE.MeshStandardMaterial({color: 0x16191c}));
      wheel.rotation.x = Math.PI / 2; wheel.position.set(0, 5, z); robot.add(wheel);
    });
    const nose = brickMesh([6, 3, 13], 0x38bdf8); nose.position.set(13, 5, 0); robot.add(nose);
    const arm = new THREE.Group();
    const beam = brickMesh([18, 2.5, 3], 0xe59035); beam.position.x = 9; arm.add(beam);
    arm.position.set(10, 8, 0); robot.add(arm); armRef.current = arm;
    robotRef.current = robot; world.add(robot);

    const trailMaterial = new THREE.LineBasicMaterial({color: 0x38bdf8});
    const trailLine = new THREE.Line(new THREE.BufferGeometry(), trailMaterial);
    trailLine.position.y = 0.7; trailRef.current = trailLine; world.add(trailLine);

    const resize = () => {
      const width = Math.max(1, host.clientWidth); const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let animation = 0;
    const draw = () => { controls.update(); renderer.render(world, camera); animation = window.requestAnimationFrame(draw); };
    draw();
    return () => {
      window.cancelAnimationFrame(animation); observer.disconnect(); controls.dispose(); renderer.dispose();
      disposeObject(world); renderer.domElement.remove(); robotRef.current = null; armRef.current = null; objectRef.current = null; trailRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (robotRef.current) {
      robotRef.current.position.set(scene.xCm, 0, scene.zCm);
      robotRef.current.rotation.y = -scene.headingDeg * Math.PI / 180;
    }
    if (armRef.current) armRef.current.rotation.z = -scene.attachmentDeg * Math.PI / 180;
    if (objectRef.current) objectRef.current.position.set(scene.objectX, 5, scene.objectZ);
    if (trailRef.current) {
      trailRef.current.geometry.dispose();
      trailRef.current.geometry = new THREE.BufferGeometry().setFromPoints(trail.map((point) => new THREE.Vector3(point.xCm, 0.7, point.zCm)));
    }
  }, [scene, trail]);

  const status = currentStep ? `${playing ? 'Running' : 'Showing'} step ${currentStep} of ${totalSteps}` : 'Ready';
  const missionText = [scene.missions.crossedLine && 'line', scene.missions.targetActive && 'target', scene.missions.deliveredObject && 'delivery'].filter(Boolean).join(', ') || 'none';
  return (
    <section className={styles.card} aria-label="FLL 3D practice field">
      <div className={styles.header}><div><h3>3D practice field</h3><p>{frame ? frame.kind : 'Orbit, pan, and zoom the reusable field.'}</p></div><span>{status}</span></div>
      <div className={styles.viewport} ref={hostRef}>{webglError && <p className={styles.fallback}>WebGL is unavailable. The program still runs through the telemetry below.</p>}</div>
      <div className={styles.readout} role="status">
        <span><strong>Pose</strong> {scene.xCm.toFixed(0)}, {scene.zCm.toFixed(0)} cm · {scene.headingDeg.toFixed(0)}°</span>
        <span><strong>Sensors</strong> {scene.distanceCm.toFixed(0)} cm · {scene.reflection.toFixed(0)}% light</span>
        <span><strong>Match</strong> {scene.elapsedSeconds.toFixed(1)} s · {scene.score} points</span>
        <span><strong>Completed</strong> {missionText}</span>
      </div>
    </section>
  );
}
