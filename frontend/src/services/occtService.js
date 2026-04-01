// STEP-Analyse-Service
// opencascade.js fuer echte B-Rep Feature-Erkennung
// occt-import-js fuer 3D-Visualisierung (Mesh)

let ocInstance = null;
let occtImportInstance = null;

// ─── opencascade.js (B-Rep Analyse) ─────────────────────────────────────────

async function initOC() {
  if (ocInstance) return ocInstance;
  const { initOpenCascade } = await import('opencascade.js');
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

  // Verify file was written
  const written = oc.FS.readFile(filename);
  console.log('readStepShape: FS geschrieben', written.length, 'bytes');

  const reader = new oc.STEPControl_Reader_1();
  const status = reader.ReadFile(filename);
  console.log('readStepShape: ReadFile Status', status, status?.value);

  if (status.value !== 1) {
    oc.FS.unlink(filename);
    throw new Error(`STEP ReadFile fehlgeschlagen (Status ${status.value})`);
  }

  reader.TransferRoots();
  const shape = reader.OneShape();

  oc.FS.unlink(filename);
  return shape;
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

async function getMesh(uint8) {
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
    vertices: new Float32Array(allVertices),
    indices:  new Uint32Array(allIndices),
  };
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────

export async function analyzeStepFile(file) {
  // Datei einmal lesen
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  console.log('analyzeStepFile:', file.name, uint8.length, 'bytes');

  // Beide WASM-Module parallel laden + Mesh parallel generieren
  const [oc, mesh] = await Promise.all([
    initOC(),
    getMesh(uint8),
  ]);

  // B-Rep Shape einlesen
  const shape = await readStepShape(oc, uint8);

  // B-Rep Analysen
  const bbox              = computeBBoxBrep(oc, shape);
  const { volumen, oberflaeche } = computePropsBrep(oc, shape);
  const { features, zylinder, konen, sphaeren } = detectFeaturesBrep(oc, shape);

  console.log('STEP Analyse fertig:', {
    abmessungen: bbox,
    volumenCm3: (volumen / 1000).toFixed(2),
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
    mesh: mesh || { vertices: new Float32Array(0), indices: new Uint32Array(0) },
  };
}
