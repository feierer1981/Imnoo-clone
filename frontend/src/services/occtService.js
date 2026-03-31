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
function vecAdd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }

/**
 * Flaechentyp einer einzelnen Mesh-Flaeche erkennen
 * occt-import-js liefert pro B-Rep-Flaeche ein separates Mesh
 * Wir analysieren Normalen und Kruemmung um den Typ zu bestimmen:
 * - planar: Alle Normalen zeigen in die gleiche Richtung
 * - zylindrisch: Normalen stehen radial von einer Achse ab
 * - konisch: Aehnlich wie Zylinder, aber mit aenderndem Radius
 * - sphaerisch: Normalen zeigen radial von einem Mittelpunkt weg
 * - toroidal: Ringfoermige Flaeche
 * - freiform: Alles andere (B-Spline etc.)
 */
function classifyFace(mesh) {
  const pos = mesh.attributes.position.array;
  const nrm = mesh.attributes.normal?.array;
  const numVerts = pos.length / 3;

  if (numVerts < 3) return { type: 'freiform' };

  // Alle Normalen und Positionen sammeln
  const normals = [];
  const positions = [];
  for (let i = 0; i < numVerts; i++) {
    positions.push([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
    if (nrm) {
      normals.push([nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]]);
    }
  }

  // Wenn keine Normalen vorhanden, aus Dreiecken berechnen
  if (normals.length === 0) {
    const idx = mesh.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const p0 = positions[idx[i]], p1 = positions[idx[i + 1]], p2 = positions[idx[i + 2]];
      const n = vecNormalize(vecCross(vecSub(p1, p0), vecSub(p2, p0)));
      normals.push(n);
    }
  }

  if (normals.length < 2) return { type: 'freiform' };

  // --- Planare Flaeche erkennen ---
  // Alle Normalen sollten parallel sein
  const refNormal = vecNormalize(normals[0]);
  let allParallel = true;
  for (let i = 1; i < normals.length; i++) {
    const dot = Math.abs(vecDot(refNormal, vecNormalize(normals[i])));
    if (dot < 0.98) { // ~11 Grad Toleranz
      allParallel = false;
      break;
    }
  }
  if (allParallel) return { type: 'planar', normal: refNormal };

  // --- Zylindrische Flaeche erkennen ---
  // Normalen liegen in einer Ebene senkrecht zur Zylinderachse
  // Kreuzprodukte benachbarter Normalen ergeben die Achsenrichtung
  const achsenKandidaten = [];
  for (let i = 0; i < Math.min(normals.length - 1, 50); i++) {
    const n1 = vecNormalize(normals[i]);
    const n2 = vecNormalize(normals[i + 1]);
    const kreuz = vecCross(n1, n2);
    const len = vecLen(kreuz);
    if (len > 0.01) {
      achsenKandidaten.push(vecNormalize(kreuz));
    }
  }

  if (achsenKandidaten.length > 2) {
    // Mittlere Achsenrichtung bestimmen
    let achse = [0, 0, 0];
    for (const k of achsenKandidaten) {
      // Richtung konsistent machen (alle in gleiche Hemispaere)
      if (vecDot(k, achsenKandidaten[0]) < 0) {
        achse = vecAdd(achse, vecScale(k, -1));
      } else {
        achse = vecAdd(achse, k);
      }
    }
    achse = vecNormalize(achse);

    if (vecLen(achse) > 0.5) {
      // Pruefen ob alle Normalen senkrecht zur Achse stehen
      let isCylinder = true;
      for (const n of normals) {
        const dot = Math.abs(vecDot(vecNormalize(n), achse));
        if (dot > 0.25) { // Normalen sollten ~90 Grad zur Achse sein
          isCylinder = false;
          break;
        }
      }

      if (isCylinder) {
        // Radius bestimmen: Abstand der Vertices zur Achse
        // Mittelpunkt auf der Achse finden
        const center = [0, 0, 0];
        for (const p of positions) {
          center[0] += p[0]; center[1] += p[1]; center[2] += p[2];
        }
        center[0] /= positions.length;
        center[1] /= positions.length;
        center[2] /= positions.length;

        // Abstaende zur Achse berechnen
        const radien = [];
        for (const p of positions) {
          const toPoint = vecSub(p, center);
          const alongAxis = vecScale(achse, vecDot(toPoint, achse));
          const perpendicular = vecSub(toPoint, alongAxis);
          radien.push(vecLen(perpendicular));
        }

        // Wenn alle Radien aehnlich sind -> Zylinder
        const avgRadius = radien.reduce((s, r) => s + r, 0) / radien.length;
        const maxDeviation = Math.max(...radien.map(r => Math.abs(r - avgRadius)));
        const relDeviation = avgRadius > 0.01 ? maxDeviation / avgRadius : 1;

        if (relDeviation < 0.15) {
          // Hoehe des Zylinders
          const axisProjections = positions.map(p => vecDot(vecSub(p, center), achse));
          const minProj = Math.min(...axisProjections);
          const maxProj = Math.max(...axisProjections);
          const hoehe = maxProj - minProj;

          return {
            type: 'zylindrisch',
            radius: avgRadius,
            durchmesser: avgRadius * 2,
            hoehe: hoehe,
            achse: achse,
          };
        }

        // Wenn Radien variieren -> koennte Konus sein
        const sortedPositions = positions
          .map(p => ({ proj: vecDot(vecSub(p, center), achse), radius: 0 }))
          .sort((a, b) => a.proj - b.proj);

        // Radien nach Achsenposition sortiert neu berechnen
        const untereRadien = [];
        const obereRadien = [];
        const midProj = (Math.min(...sortedPositions.map(s => s.proj)) +
                         Math.max(...sortedPositions.map(s => s.proj))) / 2;

        for (let i = 0; i < positions.length; i++) {
          const proj = vecDot(vecSub(positions[i], center), achse);
          const toPoint = vecSub(positions[i], center);
          const alongAxis = vecScale(achse, vecDot(toPoint, achse));
          const r = vecLen(vecSub(toPoint, alongAxis));

          if (proj < midProj) untereRadien.push(r);
          else obereRadien.push(r);
        }

        if (untereRadien.length > 0 && obereRadien.length > 0) {
          const avgUnterer = untereRadien.reduce((s, r) => s + r, 0) / untereRadien.length;
          const avgOberer = obereRadien.reduce((s, r) => s + r, 0) / obereRadien.length;

          if (Math.abs(avgUnterer - avgOberer) > avgRadius * 0.1) {
            return {
              type: 'konisch',
              radiusUnten: Math.max(avgUnterer, avgOberer),
              radiusOben: Math.min(avgUnterer, avgOberer),
            };
          }
        }
      }
    }
  }

  // --- Sphaerische Flaeche erkennen ---
  // Alle Normalen zeigen vom gleichen Mittelpunkt weg
  // Pruefe ob Normalen-Richtung mit Position-zum-Zentrum uebereinstimmt
  const center = [0, 0, 0];
  for (const p of positions) {
    center[0] += p[0]; center[1] += p[1]; center[2] += p[2];
  }
  center[0] /= positions.length;
  center[1] /= positions.length;
  center[2] /= positions.length;

  let isSphere = true;
  const sphereRadien = [];
  for (let i = 0; i < positions.length && i < normals.length; i++) {
    const toCenter = vecSub(positions[i], center);
    const dist = vecLen(toCenter);
    if (dist > 0.01) {
      sphereRadien.push(dist);
      const dir = vecNormalize(toCenter);
      const n = vecNormalize(normals[i]);
      const dot = Math.abs(vecDot(dir, n));
      if (dot < 0.9) {
        isSphere = false;
        break;
      }
    }
  }

  if (isSphere && sphereRadien.length > 3) {
    const avgR = sphereRadien.reduce((s, r) => s + r, 0) / sphereRadien.length;
    const maxDev = Math.max(...sphereRadien.map(r => Math.abs(r - avgR)));
    if (avgR > 0.01 && maxDev / avgR < 0.1) {
      return { type: 'sphaerisch', radius: avgR, durchmesser: avgR * 2 };
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

  for (const mesh of meshData.meshes) {
    totalVertices += mesh.attributes.position.array.length / 3;
    totalTriangles += mesh.index.array.length / 3;

    const classification = classifyFace(mesh);
    faceTypes[classification.type] = (faceTypes[classification.type] || 0) + 1;

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

  // Zylinder nach Durchmesser sortieren und Duplikate zusammenfassen
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
