// 3D-Vorschau Komponente mit Three.js
// Rendert Mesh-Daten als interaktives 3D-Modell mit Drehen, Zoomen und Kantenanzeige

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function StepViewer({ meshData, width = 500, height = 400 }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const frameIdRef = useRef(null);

  const initScene = useCallback(() => {
    if (!containerRef.current || !meshData) return;

    const { vertices, indices } = meshData;
    if (!vertices || vertices.length === 0) return;

    // Vorherige Szene aufraeumen
    cleanup();

    const container = containerRef.current;
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;

    // Renderer erstellen
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0xf8fafc); // Heller Hintergrund
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Szene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Kamera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
    cameraRef.current = camera;

    // Geometrie aus Mesh-Daten erstellen
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    // Bounding Box fuer Zentrierung berechnen
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    // Geometrie zentrieren
    geometry.translate(-center.x, -center.y, -center.z);

    // Bauteil-Material (CAD-typisch: leichtes Blau-Grau mit Glanz)
    const material = new THREE.MeshPhongMaterial({
      color: 0x8892b0,
      specular: 0x444444,
      shininess: 60,
      side: THREE.DoubleSide,
      flatShading: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Kanten anzeigen (CAD-typische Darstellung)
    const edgeGeometry = new THREE.EdgesGeometry(geometry, 30); // 30 Grad Winkel-Schwelle
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x334155,
      linewidth: 1,
      opacity: 0.4,
      transparent: true,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    scene.add(edges);

    // Beleuchtung
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(1, 1, 1);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-1, -0.5, -1);
    scene.add(dirLight2);

    // Kamera positionieren
    const distance = maxDim * 2;
    camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
    camera.lookAt(0, 0, 0);

    // OrbitControls fuer Maus-Interaktion (Drehen, Zoomen, Verschieben)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // Render-Loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  }, [meshData, width, height]);

  // Aufraeumen bei Unmount oder neuen Daten
  const cleanup = useCallback(() => {
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }
    if (controlsRef.current) {
      controlsRef.current.dispose();
      controlsRef.current = null;
    }
    if (rendererRef.current) {
      rendererRef.current.dispose();
      if (rendererRef.current.domElement?.parentNode) {
        rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current = null;
    }
    if (sceneRef.current) {
      sceneRef.current.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      sceneRef.current = null;
    }
  }, []);

  useEffect(() => {
    initScene();
    return cleanup;
  }, [initScene, cleanup]);

  // Responsives Resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div>
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden bg-slate-50"
        style={{ height: `${height}px` }}
      />
      <p className="text-xs text-gray-400 mt-2 text-center">
        Maus: Drehen | Scrollen: Zoomen | Rechtsklick: Verschieben
      </p>
    </div>
  );
}

export default StepViewer;
