// STEP-Analyse-Service
// Nutzt occt-import-js (WASM) zum zuverlaessigen Parsen von STEP/STP-Dateien im Browser
// https://github.com/nicholasgasior/occt-import-js

let occtInitPromise = null;

/**
 * occt-import-js WASM-Modul laden (Singleton)
 */
async function initOCCT() {
  if (occtInitPromise) return occtInitPromise;

  occtInitPromise = (async () => {
    const occtImportJs = (await import('occt-import-js')).default;

    // WASM-Datei aus dem public-Ordner laden (funktioniert lokal und auf Firebase)
    const wasmResponse = await fetch('/occt-import-js.wasm');
    if (!wasmResponse.ok) {
      throw new Error('WASM-Datei konnte nicht geladen werden: ' + wasmResponse.status);
    }
    const wasmBuffer = await wasmResponse.arrayBuffer();

    const occt = await occtImportJs({
      wasmBinary: new Uint8Array(wasmBuffer),
    });

    console.log('occt-import-js WASM geladen');
    return occt;
  })();

  return occtInitPromise;
}

/**
 * Bounding Box aus Mesh-Vertices berechnen
 */
function computeBoundingBox(meshData) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const mesh of meshData.meshes) {
    const coords = mesh.attributes.position.array;
    for (let i = 0; i < coords.length; i += 3) {
      const x = coords[i], y = coords[i + 1], z = coords[i + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
  }

  return {
    laenge: Math.abs(maxX - minX),
    breite: Math.abs(maxY - minY),
    hoehe: Math.abs(maxZ - minZ),
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

/**
 * Volumen aus Dreiecks-Mesh berechnen (Divergenztheorem)
 * Funktioniert fuer geschlossene Meshes
 */
function computeVolume(meshData) {
  let volume = 0;

  for (const mesh of meshData.meshes) {
    const verts = mesh.attributes.position.array;
    const idx = mesh.index.array;

    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;

      const ax = verts[a], ay = verts[a + 1], az = verts[a + 2];
      const bx = verts[b], by = verts[b + 1], bz = verts[b + 2];
      const cx = verts[c], cy = verts[c + 1], cz = verts[c + 2];

      // Signiertes Volumen des Tetraeders zum Ursprung
      volume += (ax * (by * cz - bz * cy) +
                 bx * (cy * az - cz * ay) +
                 cx * (ay * bz - az * by)) / 6.0;
    }
  }

  return Math.abs(volume);
}

/**
 * Oberflaeche aus Dreiecks-Mesh berechnen
 */
function computeSurfaceArea(meshData) {
  let area = 0;

  for (const mesh of meshData.meshes) {
    const verts = mesh.attributes.position.array;
    const idx = mesh.index.array;

    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;

      // Kanten-Vektoren
      const abx = verts[b] - verts[a], aby = verts[b + 1] - verts[a + 1], abz = verts[b + 2] - verts[a + 2];
      const acx = verts[c] - verts[a], acy = verts[c + 1] - verts[a + 1], acz = verts[c + 2] - verts[a + 2];

      // Kreuzprodukt
      const cx = aby * acz - abz * acy;
      const cy = abz * acx - abx * acz;
      const cz = abx * acy - aby * acx;

      area += Math.sqrt(cx * cx + cy * cy + cz * cz) / 2.0;
    }
  }

  return area;
}

/**
 * Features zaehlen: Anzahl der Meshes (entspricht grob den B-Rep Flaechen),
 * Gesamtzahl Dreiecke und Vertices
 */
function countFeatures(meshData) {
  let totalTriangles = 0;
  let totalVertices = 0;

  for (const mesh of meshData.meshes) {
    totalVertices += mesh.attributes.position.array.length / 3;
    totalTriangles += mesh.index.array.length / 3;
  }

  return {
    faces: meshData.meshes.length,
    triangles: totalTriangles,
    vertices: totalVertices,
  };
}

/**
 * Alle Mesh-Daten fuer die 3D-Vorschau zusammenfuegen
 */
function combineMeshes(meshData) {
  const allVertices = [];
  const allIndices = [];
  let vertexOffset = 0;

  for (const mesh of meshData.meshes) {
    const verts = mesh.attributes.position.array;
    const idx = mesh.index.array;

    for (let i = 0; i < verts.length; i++) {
      allVertices.push(verts[i]);
    }

    for (let i = 0; i < idx.length; i++) {
      allIndices.push(idx[i] + vertexOffset);
    }

    vertexOffset += verts.length / 3;
  }

  return {
    vertices: new Float32Array(allVertices),
    indices: new Uint32Array(allIndices),
  };
}

/**
 * Hauptfunktion: STEP-Datei komplett analysieren
 * Gibt alle extrahierten Informationen zurueck
 */
export async function analyzeStepFile(file) {
  const occt = await initOCCT();

  // Datei als ArrayBuffer einlesen
  const buffer = await file.arrayBuffer();
  const fileBuffer = new Uint8Array(buffer);

  console.log('STEP-Datei geladen:', file.name, fileBuffer.length, 'bytes');

  // STEP-Datei mit occt-import-js parsen
  const result = occt.ReadStepFile(fileBuffer, null);

  console.log('STEP Parse-Ergebnis:', result.success, '- Meshes:', result.meshes?.length);

  if (!result.success || !result.meshes || result.meshes.length === 0) {
    throw new Error(
      'STEP-Datei konnte nicht gelesen werden. ' +
      'Bitte pruefen ob die Datei ein gueltiges STEP-Format hat.'
    );
  }

  // Analysen durchfuehren
  const boundingBox = computeBoundingBox(result);
  const volumenMm3 = computeVolume(result);
  const oberflaecheMm2 = computeSurfaceArea(result);
  const features = countFeatures(result);
  const mesh = combineMeshes(result);

  console.log('Analyse abgeschlossen:', {
    abmessungen: boundingBox,
    volumenMm3,
    faces: features.faces,
  });

  return {
    abmessungen: {
      laenge: Math.round(boundingBox.laenge * 100) / 100,
      breite: Math.round(boundingBox.breite * 100) / 100,
      hoehe: Math.round(boundingBox.hoehe * 100) / 100,
    },
    volumenMm3: Math.round(volumenMm3 * 100) / 100,
    volumenCm3: Math.round((volumenMm3 / 1000) * 100) / 100,
    oberflaecheMm2: Math.round(oberflaecheMm2 * 100) / 100,
    oberflaecheCm2: Math.round((oberflaecheMm2 / 100) * 100) / 100,
    features,
    // occt-import-js liefert keine Flaechentypen, daher leeres Array
    bohrungen: [],
    mesh,
  };
}
