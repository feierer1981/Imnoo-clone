// STEP-Analyse-Service
// opencascade.js fuer echte B-Rep Feature-Erkennung
// occt-import-js fuer 3D-Visualisierung (Mesh)

let ocInstance = null;
let occtImportInstance = null;

// ─── opencascade.js (B-Rep Analyse) ─────────────────────────────────────────

async function initOC() {
  if (ocInstance) return ocInstance;
  const mod = await import('opencascade.js');
  // v2 (beta): default export; v1: named export
  const initOpenCascade = mod.default || mod.initOpenCascade;
  ocInstance = await initOpenCascade();
  return ocInstance;
}

// ─── occt-import-js (3D-Mesh fuer Vorschau) ──────────────────────────────────

async function initOcctImport() {
  if (occtImportInstance) return occtImportInstance;
  const occtImportJs = (await import('occt-import-js')).default;
  const wasmResponse = await fetch('/occt-import-js.wasm');
  const wasmBuffer = await wasmResponse.arrayBuffer();
  occtImportInstance = await occtImportJs({ wasmBinary: new Uint8Array(wasmBuffer) });
  return occtImportInstance;
}

// ─── STEP-Datei mit opencascade.js einlesen ───────────────────────────────────

async function readStepShape(oc, uint8) {
  console.log('readStepShape: Dateigröße', uint8.length, 'bytes');

  const filename = 'upload_brep.step';
  try { oc.FS.unlink(filename); } catch {}
  oc.FS.writeFile(filename, uint8);

  // Verschiedene Reader-Methoden versuchen
  const methods = [
    { name: 'STEPControl_Reader_1', create: () => new oc.STEPControl_Reader_1() },
  ];

  // STEPCAFControl_Reader verfuegbar?
  if (oc.STEPCAFControl_Reader_1) {
    methods.push({
      name: 'STEPCAFControl_Reader_1',
      create: () => new oc.STEPCAFControl_Reader_1(),
    });
  }

  for (const method of methods) {
    try {
      const reader = method.create();
      const status = reader.ReadFile(filename);
      console.log(`readStepShape [${method.name}]: Status ${status?.value}`);

      const nbRoots = reader.NbRootsForTransfer();
      console.log(`readStepShape [${method.name}]: NbRoots ${nbRoots}`);

      // Status 1 = Erfolg, Status 2 = Fehler aber evtl. noch Roots vorhanden
      if (nbRoots > 0) {
        console.log(`readStepShape [${method.name}]: TransferRoots (${nbRoots} roots)...`);
        // TransferRoots: v2 braucht Message_ProgressRange, v1 ohne Argument
        let transferred = false;
        // Versuch 1: Message_ProgressRange_1 (v2 API)
        if (!transferred && oc.Message_ProgressRange_1) {
          try {
            reader.TransferRoots(new oc.Message_ProgressRange_1());
            transferred = true;
          } catch (e) { console.log('TransferRoots(ProgressRange_1) fehlgeschlagen:', e.message); }
        }
        // Versuch 2: Message_ProgressRange (v2 alternativ)
        if (!transferred && oc.Message_ProgressRange) {
          try {
            reader.TransferRoots(new oc.Message_ProgressRange());
            transferred = true;
          } catch (e) { console.log('TransferRoots(ProgressRange) fehlgeschlagen:', e.message); }
        }
        // Versuch 3: Ohne Argument (v1 API)
        if (!transferred) {
          reader.TransferRoots();
        }
        const shape = reader.OneShape();

        if (!shape.IsNull()) {
          console.log(`readStepShape [${method.name}]: Shape OK, Type ${shape.ShapeType().value}`);
          oc.FS.unlink(filename);
          return shape;
        }
        console.log(`readStepShape [${method.name}]: Shape ist null`);
      }
    } catch (e) {
      console.warn(`readStepShape [${method.name}]: Fehler:`, e.message);
    }
  }

  oc.FS.unlink(filename);
  throw new Error('STEP ReadFile: Kein Reader konnte die Datei lesen');
}

// ─── B-Rep Feature-Erkennung ──────────────────────────────────────────────────

function detectFeaturesBrep(oc, shape) {
  const faceTypes = {
    planar: 0,
    zylindrisch: 0,
    konisch: 0,
    sphaerisch: 0,
    toroidal: 0,
    freiform: 0,
  };

  const zylinder = [];
  const konen   = [];
  const sphaeren = [];
  let faceCount = 0;
  let edgeCount = 0;
  let vertexCount = 0;

  const faceExplorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  while (faceExplorer.More()) {
    faceCount++;
    try {
      const face = oc.TopoDS.Face_1(faceExplorer.Current());

      const surface = oc.BRep_Tool.Surface_2(face);

      const adaptor = new oc.GeomAdaptor_Surface_2(surface);
      const surfType = adaptor.GetType();

      // surfType ist ein Enum: GeomAbs_SurfaceType
      const typeVal = surfType.value !== undefined ? surfType.value : surfType;

      // GeomAbs_SurfaceType Enum-Werte:
      // 0=Plane, 1=Cylinder, 2=Cone, 3=Sphere, 4=Torus,
      // 5=BezierSurface, 6=BSplineSurface, 7=SurfaceOfRevolution,
      // 8=SurfaceOfExtrusion, 9=OffsetSurface, 10=OtherSurface

      if (typeVal === 0) {
        faceTypes.planar++;

      } else if (typeVal === 1) {
        faceTypes.zylindrisch++;
        try {
          const cyl = adaptor.Cylinder();
          const radius = cyl.Radius();

          // Hoehe aus Bounding Box der Flaeche
          const faceBbox = new oc.Bnd_Box_1();
          oc.BRepBndLib.Add(face, faceBbox, false);
          const fMin = faceBbox.CornerMin();
          const fMax = faceBbox.CornerMax();
          const dx = Math.abs(fMax.X() - fMin.X());
          const dy = Math.abs(fMax.Y() - fMin.Y());
          const dz = Math.abs(fMax.Z() - fMin.Z());
          const hoehe = Math.max(dx, dy, dz);

          zylinder.push({
            radius: Math.round(radius * 100) / 100,
            durchmesser: Math.round(radius * 2 * 100) / 100,
            hoehe: Math.round(hoehe * 100) / 100,
          });
        } catch { /* Radius nicht auslesbar */ }

      } else if (typeVal === 2) {
        faceTypes.konisch++;
        try {
          const cone = adaptor.Cone();
          const r1 = cone.RefRadius();
          const angle = cone.HalfAngle();
          konen.push({
            radiusRef: Math.round(r1 * 100) / 100,
            halbwinkel: Math.round((angle * 180 / Math.PI) * 10) / 10,
          });
        } catch { /* Nicht auslesbar */ }

      } else if (typeVal === 3) {
        faceTypes.sphaerisch++;
        try {
          const sph = adaptor.Sphere();
          const r = sph.Radius();
          sphaeren.push({
            radius: Math.round(r * 100) / 100,
            durchmesser: Math.round(r * 2 * 100) / 100,
          });
        } catch { /* Nicht auslesbar */ }

      } else if (typeVal === 4) {
        faceTypes.toroidal++;

      } else {
        faceTypes.freiform++;
      }

    } catch { /* Flaeche uebersprungen */ }
    faceExplorer.Next();
  }

  // Kanten zaehlen
  const edgeExplorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );
  while (edgeExplorer.More()) { edgeCount++; edgeExplorer.Next(); }

  // Vertices zaehlen
  const vertexExplorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_VERTEX,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );
  while (vertexExplorer.More()) { vertexCount++; vertexExplorer.Next(); }

  // Zylinder zusammenfassen: gleicher Durchmesser (Toleranz 0.3mm) -> gruppieren
  const zylinderGruppiert = [];
  for (const z of zylinder.sort((a, b) => a.durchmesser - b.durchmesser)) {
    const existing = zylinderGruppiert.find(
      g => Math.abs(g.durchmesser - z.durchmesser) < 0.3
    );
    if (existing) {
      existing.anzahl++;
      existing.hoehe = Math.max(existing.hoehe, z.hoehe);
    } else {
      zylinderGruppiert.push({ ...z, anzahl: 1 });
    }
  }

  return {
    features: { faces: faceCount, edges: edgeCount, vertices: vertexCount, faceTypes },
    zylinder: zylinderGruppiert,
    konen,
    sphaeren,
  };
}

// ─── Bounding Box aus B-Rep berechnen ────────────────────────────────────────

function computeBBoxBrep(oc, shape) {
  const bbox = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bbox, false);
  const min = bbox.CornerMin();
  const max = bbox.CornerMax();
  return {
    laenge: Math.abs(max.X() - min.X()),
    breite: Math.abs(max.Y() - min.Y()),
    hoehe:  Math.abs(max.Z() - min.Z()),
  };
}

// ─── Volumen + Oberflaeche aus B-Rep berechnen ───────────────────────────────

function computePropsBrep(oc, shape) {
  let volumen = 0;
  let oberflaeche = 0;

  try {
    const vProps = new oc.GProp_GProps_1();
    oc.BRepGProp.VolumeProperties_1(shape, vProps, false, false, false);
    volumen = Math.abs(vProps.Mass());
  } catch {}

  try {
    const sProps = new oc.GProp_GProps_1();
    oc.BRepGProp.SurfaceProperties_1(shape, sProps, false, false);
    oberflaeche = Math.abs(sProps.Mass());
  } catch {}

  return { volumen, oberflaeche };
}

// ─── Mesh fuer 3D-Vorschau (occt-import-js) ──────────────────────────────────

async function parseMeshData(uint8) {
  const occtImport = await initOcctImport();
  const result = occtImport.ReadStepFile(uint8, null);

  if (!result.success || !result.meshes?.length) return null;

  const allVertices = [];
  const allIndices  = [];
  let offset = 0;

  for (const mesh of result.meshes) {
    const verts = mesh.attributes.position.array;
    const idx   = mesh.index.array;
    for (let i = 0; i < verts.length; i++) allVertices.push(verts[i]);
    for (let i = 0; i < idx.length; i++) allIndices.push(idx[i] + offset);
    offset += verts.length / 3;
  }

  return {
    combinedMesh: {
      vertices: new Float32Array(allVertices),
      indices:  new Uint32Array(allIndices),
    },
    rawMeshes: result.meshes,
  };
}

// ─── Fallback: Mesh-basierte Analyse wenn B-Rep scheitert ────────────────────

function analyzeMeshFallback(meshes) {
  // Bounding Box aus allen Vertices
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let totalVolume = 0;
  let totalArea = 0;

  for (const mesh of meshes) {
    const v = mesh.attributes.position.array;
    const idx = mesh.index.array;

    for (let i = 0; i < v.length; i += 3) {
      if (v[i] < minX) minX = v[i];
      if (v[i+1] < minY) minY = v[i+1];
      if (v[i+2] < minZ) minZ = v[i+2];
      if (v[i] > maxX) maxX = v[i];
      if (v[i+1] > maxY) maxY = v[i+1];
      if (v[i+2] > maxZ) maxZ = v[i+2];
    }

    // Volumen (Divergenztheorem) und Oberflaeche aus Dreiecken
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i]*3, b = idx[i+1]*3, c = idx[i+2]*3;
      const ax = v[a], ay = v[a+1], az = v[a+2];
      const bx = v[b], by = v[b+1], bz = v[b+2];
      const cx = v[c], cy = v[c+1], cz = v[c+2];

      totalVolume += (ax*(by*cz - bz*cy) + bx*(cy*az - cz*ay) + cx*(ay*bz - az*by)) / 6.0;

      const abx = bx-ax, aby = by-ay, abz = bz-az;
      const acx = cx-ax, acy = cy-ay, acz = cz-az;
      const nx = aby*acz - abz*acy;
      const ny = abz*acx - abx*acz;
      const nz = abx*acy - aby*acx;
      totalArea += Math.sqrt(nx*nx + ny*ny + nz*nz) / 2.0;
    }
  }

  const bbox = {
    laenge: Math.abs(maxX - minX),
    breite: Math.abs(maxY - minY),
    hoehe:  Math.abs(maxZ - minZ),
  };

  // Pro-Face Normalenanalyse fuer Feature-Erkennung
  const faceTypes = { planar: 0, zylindrisch: 0, konisch: 0, sphaerisch: 0, toroidal: 0, freiform: 0 };
  const zylinder = [];

  for (const mesh of meshes) {
    const v = mesh.attributes.position.array;
    const idx = mesh.index.array;
    const numVerts = v.length / 3;
    if (numVerts < 3) { faceTypes.freiform++; continue; }

    // Normalen aller Dreiecke dieser Flaeche berechnen
    const normals = [];
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i]*3, b = idx[i+1]*3, c = idx[i+2]*3;
      const abx = v[b]-v[a], aby = v[b+1]-v[a+1], abz = v[b+2]-v[a+2];
      const acx = v[c]-v[a], acy = v[c+1]-v[a+1], acz = v[c+2]-v[a+2];
      const nx = aby*acz - abz*acy;
      const ny = abz*acx - abx*acz;
      const nz = abx*acy - aby*acx;
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
      if (len > 1e-10) normals.push([nx/len, ny/len, nz/len]);
    }

    if (normals.length < 1) { faceTypes.freiform++; continue; }

    // Pruefen ob alle Normalen parallel sind (= planare Flaeche)
    const ref = normals[0];
    let allParallel = true;
    for (const n of normals) {
      const dot = Math.abs(ref[0]*n[0] + ref[1]*n[1] + ref[2]*n[2]);
      if (dot < 0.98) { allParallel = false; break; }
    }

    if (allParallel) {
      faceTypes.planar++;
      continue;
    }

    // Zylindertest: Mittelpunkt und Radien berechnen
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < numVerts; i++) {
      cx += v[i*3]; cy += v[i*3+1]; cz += v[i*3+2];
    }
    cx /= numVerts; cy /= numVerts; cz /= numVerts;

    // Fuer jede Hauptachse testen ob Radien konsistent sind
    const axes = [[1,0,0],[0,1,0],[0,0,1]];
    let bestFit = null;

    for (const axis of axes) {
      const radii = [];
      const projs = [];
      for (let i = 0; i < numVerts; i++) {
        const dx = v[i*3]-cx, dy = v[i*3+1]-cy, dz = v[i*3+2]-cz;
        const proj = dx*axis[0] + dy*axis[1] + dz*axis[2];
        const px = dx - proj*axis[0], py = dy - proj*axis[1], pz = dz - proj*axis[2];
        radii.push(Math.sqrt(px*px + py*py + pz*pz));
        projs.push(proj);
      }

      const avgR = radii.reduce((s,r) => s+r, 0) / radii.length;
      if (avgR < 0.1) continue;

      const variance = radii.reduce((s,r) => s + (r-avgR)**2, 0) / radii.length;
      const cv = Math.sqrt(variance) / avgR;

      if (cv < 0.15 && (!bestFit || cv < bestFit.cv)) {
        const minP = Math.min(...projs);
        const maxP = Math.max(...projs);
        bestFit = { avgR, cv, hoehe: maxP - minP };
      }
    }

    if (bestFit && bestFit.avgR > 0.1) {
      faceTypes.zylindrisch++;
      zylinder.push({
        radius: Math.round(bestFit.avgR * 100) / 100,
        durchmesser: Math.round(bestFit.avgR * 2 * 100) / 100,
        hoehe: Math.round(bestFit.hoehe * 100) / 100,
      });
    } else {
      faceTypes.freiform++;
    }
  }

  // Zylinder gruppieren
  const zylinderGruppiert = [];
  for (const z of zylinder.sort((a,b) => a.durchmesser - b.durchmesser)) {
    const existing = zylinderGruppiert.find(g => Math.abs(g.durchmesser - z.durchmesser) < 0.5);
    if (existing) { existing.anzahl++; existing.hoehe = Math.max(existing.hoehe, z.hoehe); }
    else zylinderGruppiert.push({ ...z, anzahl: 1 });
  }

  return {
    abmessungen: {
      laenge: Math.round(bbox.laenge * 100) / 100,
      breite: Math.round(bbox.breite * 100) / 100,
      hoehe:  Math.round(bbox.hoehe  * 100) / 100,
    },
    volumenMm3:     Math.round(Math.abs(totalVolume) * 100) / 100,
    volumenCm3:     Math.round((Math.abs(totalVolume) / 1000) * 100) / 100,
    oberflaecheMm2: Math.round(totalArea * 100) / 100,
    oberflaecheCm2: Math.round((totalArea / 100) * 100) / 100,
    features: { faces: meshes.length, edges: 0, vertices: 0, faceTypes },
    bohrungen: zylinderGruppiert,
    konen: [],
    sphaeren: [],
    analyseModus: 'mesh',
  };
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────

export async function analyzeStepFile(file) {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  console.log('analyzeStepFile:', file.name, uint8.length, 'bytes');

  // WASM-Module parallel laden
  const [oc, meshData] = await Promise.all([
    initOC().catch(err => { console.warn('opencascade.js Ladefehler:', err); return null; }),
    parseMeshData(uint8),
  ]);

  const mesh = meshData?.combinedMesh || { vertices: new Float32Array(0), indices: new Uint32Array(0) };

  // B-Rep Analyse versuchen
  if (oc) {
    try {
      const shape = await readStepShape(oc, uint8);
      const bbox              = computeBBoxBrep(oc, shape);
      const { volumen, oberflaeche } = computePropsBrep(oc, shape);
      const { features, zylinder, konen, sphaeren } = detectFeaturesBrep(oc, shape);

      console.log('B-Rep Analyse erfolgreich:', {
        faceTypes: features.faceTypes,
        zylinder: zylinder.length,
      });

      return {
        abmessungen: {
          laenge: Math.round(bbox.laenge * 100) / 100,
          breite: Math.round(bbox.breite * 100) / 100,
          hoehe:  Math.round(bbox.hoehe  * 100) / 100,
        },
        volumenMm3:      Math.round(volumen * 100) / 100,
        volumenCm3:      Math.round((volumen / 1000) * 100) / 100,
        oberflaecheMm2:  Math.round(oberflaeche * 100) / 100,
        oberflaecheCm2:  Math.round((oberflaeche / 100) * 100) / 100,
        features,
        bohrungen: zylinder,
        konen,
        sphaeren,
        mesh,
        analyseModus: 'brep',
      };
    } catch (err) {
      console.warn('B-Rep Analyse fehlgeschlagen, Fallback auf Mesh:', err.message);
    }
  }

  // Fallback: Mesh-basierte Analyse
  if (!meshData?.rawMeshes) {
    throw new Error('STEP-Datei konnte weder mit B-Rep noch mit Mesh-Analyse gelesen werden.');
  }

  console.log('Verwende Mesh-Fallback Analyse...');
  const fallback = analyzeMeshFallback(meshData.rawMeshes);
  return { ...fallback, mesh };
}
