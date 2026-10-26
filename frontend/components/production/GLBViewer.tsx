'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './production.module.css';

export default function GLBViewer({ url }: { url: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    setState('loading');
    void (async () => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      const element = host.current;
      if (disposed || !element) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        setState('error');
        return;
      }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      element.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = environment;
      scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.6));
      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
      camera.position.set(2, 1.2, 3);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.4;
      const resize = () => {
        const width = element.clientWidth || 1;
        const height = element.clientHeight || 1;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      new GLTFLoader().load(url, (gltf) => {
        if (disposed) return;
        const root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);
        const radius = Math.max(size.length() / 2, 0.001);
        camera.near = radius / 100;
        camera.far = radius * 100;
        camera.position.set(radius * 1.2, radius * 0.7, radius * 2.2);
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.minDistance = radius * 0.4;
        controls.maxDistance = radius * 8;
        scene.add(root);
        setState('ready');
      }, undefined, () => { if (!disposed) setState('error'); });
      let frame = 0;
      const tick = () => {
        frame = requestAnimationFrame(tick);
        controls.update();
        renderer.render(scene, camera);
      };
      tick();
      const stop = () => { controls.autoRotate = false; };
      renderer.domElement.addEventListener('pointerdown', stop);
      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        renderer.domElement.removeEventListener('pointerdown', stop);
        controls.dispose();
        scene.traverse((object) => {
          const mesh = object as { geometry?: { dispose: () => void }; material?: { dispose: () => void } | { dispose: () => void }[] };
          mesh.geometry?.dispose();
          (Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []).forEach((material) => material.dispose());
        });
        environment.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();
    return () => { disposed = true; cleanup(); };
  }, [url]);

  return <div ref={host} className={styles.viewer} data-testid="glb-viewer">
    {state !== 'ready' && <div className={styles.viewerState}>{state === 'loading' ? 'Loading model…' : 'Preview unavailable. Download the GLB instead.'}</div>}
    {state === 'ready' && <div className={styles.viewerNote}>Drag to orbit · scroll to zoom</div>}
  </div>;
}
