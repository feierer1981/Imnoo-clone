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
 * Vektor-Hilfsfunktionen
 */
function vecSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vecCross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function vecDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function vecLen(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }
function vecNormalize(v) {
  const l = vecLen(v);
  return l > 1e-10 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
}
function vecScale(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }

/**
 * Mittelpunkt (Centroid) einer Punktwolke berechnen
 */
function computeCentroid(positions) {
  const c = [0, 0, 0];
  for (const p of positions) {
    c[0] += p[0]; c[1] += p[1]; c[2] += p[2];
  }
  c[0] /= positions.length; c[1] /= positions.length; c[2] /= positions.length;
  return c;
}

/**
 * PCA (Hauptkomponentenanalyse) einer Punktwolke
 * Gibt die 3 Hauptachsen und deren Eigenwerte zurueck
 * Verwendet Power-Iteration (einfach, braucht keine Library)
 */
function computePCA(positions) {
  const center = computeCentroid(positions);
  const n = positions.length;

  // 3x3 Kovarianzmatrix berechnen
  const cov = [[0,0,0],[0,0,0],[0,0,0]];
  for (const p of positions) {
    const d = vecSub(p, center);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        cov[i][j] += d[i] * d[j];
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      cov[i][j] /= n;
    }
  }

  // Eigenwerte/-vektoren durch Power-Iteration (3 Durchlaeufe fuer 3 Achsen)
  const axes = [];
  const eigenvalues = [];
  const mat = cov.map(r => [...r]);

  for (let k = 0; k < 3; k++) {
    let v = [1, 0.1 * k, 0.01 * k]; // Startvektor
    v = vecNormalize(v);

    // 50 Iterationen reichen fuer 3x3 Matrix
    for (let iter = 0; iter < 50; iter++) {
      const newV = [
        mat[0][0]*v[0] + mat[0][1]*v[1] + mat[0][2]*v[2],
        mat[1][0]*v[0] + mat[1][1]*v[1] + mat[1][2]*v[2],
        mat[2][0]*v[0] + mat[2][1]*v[1] + mat[2][2]*v[2],
      ];
      v = vecNormalize(newV);
    }

    // Eigenwert = v^T * M * v
    const mv = [
      mat[0][0]*v[0] + mat[0][1]*v[1] + mat[0][2]*v[2],
      mat[1][0]*v[0] + mat[1][1]*v[1] + mat[1][2]*v[2],
      mat[2][0]*v[0] + mat[2][1]*v[1] + mat[2][2]*v[2],
    ];
    const eigenvalue = vecDot(v, mv);

    axes.push(v);
    eigenvalues.push(eigenvalue);

    // Deflation: Matrix um gefundene Komponente reduzieren
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        mat[i][j] -= eigenvalue * v[i] * v[j];
      }
    }
  }

  return { axes, eigenvalues, center };
}

/**
 * Pruefen ob Vertices auf einem Zylinder um eine Achse liegen
 * Gibt null zurueck wenn nicht zylindrisch, sonst Radius-Info
 */
function fitCylinder(positions, axis, center) {
  if (positions.length < 6) return null;

  // Abstand jedes Vertex zur Achse berechnen
  const radii = [];
  for (const p of positions) {
    const toPoint = vecSub(p, center);
    const alongAxis = vecScale(axis, vecDot(toPoint, axis));
    const perpendicular = vecSub(toPoint, alongAxis);
    radii.push(vecLen(perpendicular));
  }

  const avgRadius = radii.reduce((s, r) => s + r, 0) / radii.length;
  if (avgRadius < 0.01) return null; // Kein sinnvoller Radius

  // Variationskoeffizient: Standardabweichung / Mittelwert
  const variance = radii.reduce((s, r) => s + (r - avgRadius) ** 2, 0) / radii.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / avgRadius;

  // Hoehe entlang der Achse
  const projections = positions.map(p => vecDot(vecSub(p, center), axis));
  const minProj = Math.min(...projections);
  const maxProj = Math.max(...projections);
  const hoehe = maxProj - minProj;

  return { avgRadius, cv, hoehe, radii };
}

/**
 * Flaechentyp einer einzelnen Mesh-Flaeche erkennen
 * Robuster geometrischer Ansatz basierend auf Vertex-Positionen und PCA
 */
function classifyFace(mesh) {
  const pos = mesh.attributes.position.array;
  const numVerts = pos.length / 3;

  if (numVerts < 4) return { type: 'freiform' };

  // Positionen als Array von [x,y,z]
  const positions = [];
  for (let i = 0; i < numVerts; i++) {
    positions.push([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
  }

  // --- 1. Planar-Test ---
  // PCA: Wenn dritte Eigenachse nahe 0, liegen alle Punkte in einer Ebene
  const pca = computePCA(positions);
  const ev = pca.eigenvalues;
  const maxEv = Math.max(ev[0], ev[1], ev[2]);

  if (maxEv < 1e-10) return { type: 'freiform' };

  // Normalisierte Eigenwerte
  const evNorm = ev.map(e => Math.abs(e) / maxEv);
  evNorm.sort((a, b) => b - a); // Absteigend sortieren

  // Planar: Kleinster Eigenwert nahe 0 (Punkte liegen in einer Ebene)
  if (evNorm[2] < 0.001 && evNorm[1] < 0.001) {
    // Nur eine Dimension hat Varianz -> Linie, nicht Flaeche
    return { type: 'freiform' };
  }

  if (evNorm[2] < 0.005) {
    // Punkte liegen in einer Ebene
    // Jetzt pruefen: Planar vs. Zylinder vs. Kreis
    // Fuer planare Flaechen: Abstand zur besten Ebene ist minimal
    // Fuer Zylinder: Punkte bilden einen Bogen/Ring in der Ebene

    // Ebenen-Normal = Achse mit kleinstem Eigenwert
    const planeNormal = pca.axes[2];

    // Abstand aller Punkte zur Ebene pruefen
    const planeDistances = positions.map(p =>
      Math.abs(vecDot(vecSub(p, pca.center), planeNormal))
    );
    const maxPlaneDist = Math.max(...planeDistances);
    const bbox = Math.sqrt(maxEv); // Grobe Bauteilgroesse

    if (maxPlaneDist < bbox * 0.02) {
      return { type: 'planar', normal: planeNormal };
    }
  }

  // --- 2. Zylinder-Test ---
  // Fuer jede der 3 PCA-Achsen als potenzielle Zylinderachse testen
  // Zusaetzlich die 3 Koordinatenachsen testen
  const candidateAxes = [
    ...pca.axes,
    [1, 0, 0], [0, 1, 0], [0, 0, 1],
  ];

  let bestCylFit = null;

  for (const axis of candidateAxes) {
    const fit = fitCylinder(positions, axis, pca.center);
    if (!fit) continue;

    // cv (Variationskoeffizient) < 0.12 = guter Zylinder-Fit (12% Toleranz)
    if (fit.cv < 0.12 && fit.avgRadius > 0.1) {
      if (!bestCylFit || fit.cv < bestCylFit.cv) {
        bestCylFit = { ...fit, axis };
      }
    }
  }

  if (bestCylFit) {
    // Pruefen ob sich der Radius entlang der Achse aendert (Konus)
    const projections = positions.map(p => vecDot(vecSub(p, pca.center), bestCylFit.axis));
    const minP = Math.min(...projections);
    const maxP = Math.max(...projections);
    const midP = (minP + maxP) / 2;

    const lowerRadii = [];
    const upperRadii = [];

    for (let i = 0; i < positions.length; i++) {
      const proj = vecDot(vecSub(positions[i], pca.center), bestCylFit.axis);
      const toPoint = vecSub(positions[i], pca.center);
      const along = vecScale(bestCylFit.axis, vecDot(toPoint, bestCylFit.axis));
      const r = vecLen(vecSub(toPoint, along));

      if (proj < midP) lowerRadii.push(r);
      else upperRadii.push(r);
    }

    if (lowerRadii.length > 2 && upperRadii.length > 2) {
      const avgLower = lowerRadii.reduce((s, r) => s + r, 0) / lowerRadii.length;
      const avgUpper = upperRadii.reduce((s, r) => s + r, 0) / upperRadii.length;
      const radiusDiff = Math.abs(avgLower - avgUpper);

      if (radiusDiff > bestCylFit.avgRadius * 0.15) {
        return {
          type: 'konisch',
          radiusUnten: Math.max(avgLower, avgUpper),
          radiusOben: Math.min(avgLower, avgUpper),
        };
      }
    }

    return {
      type: 'zylindrisch',
      radius: bestCylFit.avgRadius,
      durchmesser: bestCylFit.avgRadius * 2,
      hoehe: bestCylFit.hoehe,
    };
  }

  // --- 3. Sphaere-Test ---
  // Alle Vertices gleicher Abstand zum Centroid
  const center = pca.center;
  const sphereRadii = positions.map(p => vecLen(vecSub(p, center)));
  const avgSphereR = sphereRadii.reduce((s, r) => s + r, 0) / sphereRadii.length;

  if (avgSphereR > 0.1) {
    const sphereVariance = sphereRadii.reduce((s, r) => s + (r - avgSphereR) ** 2, 0) / sphereRadii.length;
    const sphereCV = Math.sqrt(sphereVariance) / avgSphereR;

    if (sphereCV < 0.08) {
      return { type: 'sphaerisch', radius: avgSphereR, durchmesser: avgSphereR * 2 };
    }
  }

  return { type: 'freiform' };
}

/**
 * Alle Flaechen klassifizieren und Features erkennen
 */
function detectFeatures(meshData) {
  const faceTypes = {
    planar: 0,
    zylindrisch: 0,
    konisch: 0,
    sphaerisch: 0,
    freiform: 0,
  };

  const zylinder = [];
  const konen = [];
  const sphaeren = [];

  let totalTriangles = 0;
  let totalVertices = 0;

  for (let fi = 0; fi < meshData.meshes.length; fi++) {
    const mesh = meshData.meshes[fi];
    totalVertices += mesh.attributes.position.array.length / 3;
    totalTriangles += mesh.index.array.length / 3;

    const classification = classifyFace(mesh);
    faceTypes[classification.type] = (faceTypes[classification.type] || 0) + 1;

    // Debug: Erste 20 Flaechen loggen
    if (fi < 20) {
      console.log(`Flaeche ${fi}: ${classification.type}`,
        classification.durchmesser ? `D=${classification.durchmesser.toFixed(1)}mm` : '',
        `(${mesh.attributes.position.array.length / 3} verts)`);
    }

    if (classification.type === 'zylindrisch') {
      zylinder.push({
        durchmesser: Math.round(classification.durchmesser * 100) / 100,
        radius: Math.round(classification.radius * 100) / 100,
        hoehe: Math.round(classification.hoehe * 100) / 100,
      });
    } else if (classification.type === 'konisch') {
      konen.push({
        radiusUnten: Math.round(classification.radiusUnten * 100) / 100,
        radiusOben: Math.round(classification.radiusOben * 100) / 100,
      });
    } else if (classification.type === 'sphaerisch') {
      sphaeren.push({
        durchmesser: Math.round(classification.durchmesser * 100) / 100,
        radius: Math.round(classification.radius * 100) / 100,
      });
    }
  }

  console.log('Feature-Erkennung:', faceTypes, `${zylinder.length} Zylinder`);

  // Zylinder nach Durchmesser sortieren und aehnliche zusammenfassen
  const zylinderGruppiert = [];
  const sorted = [...zylinder].sort((a, b) => a.durchmesser - b.durchmesser);
  for (const z of sorted) {
    const existing = zylinderGruppiert.find(
      g => Math.abs(g.durchmesser - z.durchmesser) < 0.5
    );
    if (existing) {
      existing.anzahl++;
    } else {
      zylinderGruppiert.push({ ...z, anzahl: 1 });
    }
  }

  return {
    features: {
      faces: meshData.meshes.length,
      triangles: totalTriangles,
      vertices: totalVertices,
      faceTypes,
    },
    zylinder: zylinderGruppiert,
    konen,
    sphaeren,
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
  const { features, zylinder, konen, sphaeren } = detectFeatures(result);
  const mesh = combineMeshes(result);

  console.log('Analyse abgeschlossen:', {
    abmessungen: boundingBox,
    volumenMm3,
    faces: features.faces,
    faceTypes: features.faceTypes,
    zylinder: zylinder.length,
    konen: konen.length,
    sphaeren: sphaeren.length,
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
    bohrungen: zylinder,
    konen,
    sphaeren,
    mesh,
  };
}
