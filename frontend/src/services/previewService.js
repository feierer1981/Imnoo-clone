// Generiert ein isometrisches Vorschaubild (JPEG-Blob) aus Three.js Mesh-Daten.
// Läuft vollständig offscreen (kein DOM-Anhang nötig).

import * as THREE from 'three';

export function generatePreviewImage(meshData, size = 512) {
  return new Promise((resolve, reject) => {
    let renderer, geometry, material, edgeGeometry, edgeMaterial;
    try {
      const { vertices, indices } = meshData;
      if (!vertices?.length || !indices?.length) {
        return reject(new Error('Keine Mesh-Daten vorhanden'));
      }

      // ── Offscreen-Renderer ──────────────────────────────────────────────────
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(size, size);
      renderer.setPixelRatio(1);
      renderer.setClearColor(0xf1f5f9); // helles Blau-Grau (Slate-100)

      // ── Szene ───────────────────────────────────────────────────────────────
      const scene = new THREE.Scene();

      // ── Geometrie ───────────────────────────────────────────────────────────
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();

      const bbox = geometry.boundingBox;
      const center = new THREE.Vector3();
      bbox.getCenter(center);
      const sizeVec = new THREE.Vector3();
      bbox.getSize(sizeVec);
      const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);

      // Geometrie zentrieren
      geometry.translate(-center.x, -center.y, -center.z);

      // ── Material & Mesh ─────────────────────────────────────────────────────
      material = new THREE.MeshPhongMaterial({
        color: 0x8892b0,
        specular: 0x555566,
        shininess: 70,
        side: THREE.DoubleSide,
      });
      scene.add(new THREE.Mesh(geometry, material));

      // Kanten (CAD-typisch)
      edgeGeometry = new THREE.EdgesGeometry(geometry, 25);
      edgeMaterial = new THREE.LineBasicMaterial({
        color: 0x2d3748,
        opacity: 0.45,
        transparent: true,
      });
      scene.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

      // ── Beleuchtung ─────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const dir1 = new THREE.DirectionalLight(0xffffff, 0.85);
      dir1.position.set(1, 1.5, 1);
      scene.add(dir1);
      const dir2 = new THREE.DirectionalLight(0xffffff, 0.25);
      dir2.position.set(-1, -0.5, -1);
      scene.add(dir2);

      // ── Isometrische OrthographicCamera ─────────────────────────────────────
      // Kamera-Position bei (1,1,1)-Richtung → klassische isometrische Ansicht
      const d = maxDim * 0.75;
      const camera = new THREE.OrthographicCamera(-d, d, d, -d, -maxDim * 10, maxDim * 10);
      camera.position.set(maxDim, maxDim * 0.65, maxDim);
      camera.lookAt(0, 0, 0);

      // ── Rendern & Bild exportieren ───────────────────────────────────────────
      renderer.render(scene, camera);

      renderer.domElement.toBlob(
        (blob) => {
          // Aufräumen
          geometry.dispose();
          material.dispose();
          edgeGeometry.dispose();
          edgeMaterial.dispose();
          renderer.dispose();
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob lieferte null'));
          }
        },
        'image/jpeg',
        0.88
      );
    } catch (err) {
      geometry?.dispose();
      material?.dispose();
      edgeGeometry?.dispose();
      edgeMaterial?.dispose();
      renderer?.dispose();
      reject(err);
    }
  });
}
