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

function detectFeaturesBrep(oc, shape, bbox) {
  const faceTypes = {
    planar: 0,
    zylindrisch: 0,
    konisch: 0,
    sphaerisch: 0,
    toroidal: 0,
    freiform: 0,
  };

  // Rohdaten pro Flaeche sammeln (fuer spaetere Analyse)
  const allFaces = [];       // { face, typeVal, adaptor, ... }
  const rawBohrungen = [];   // 360° Zylinder
  const rawRadien    = [];   // < 360° Zylinder
  const rawKonen     = [];
  const rawSphaeren  = [];
  let faceCount = 0;
  let edgeCount = 0;
  let vertexCount = 0;

  // Bauteil-Hoehe fuer Durchgangsbohrung-Erkennung
  const bboxHoehe = Math.max(bbox.laenge, bbox.breite, bbox.hoehe);

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
      const typeVal = surfType.value !== undefined ? surfType.value : surfType;

      allFaces.push({ face, typeVal, adaptor });

      if (typeVal === 0) {
        faceTypes.planar++;

      } else if (typeVal === 1) {
        faceTypes.zylindrisch++;
        try {
          const cyl = adaptor.Cylinder();
          const radius = cyl.Radius();
          const axis = cyl.Axis();
          const axisDir = axis.Direction();
          const axisLoc = axis.Location();

          // Winkelbereich (U = Winkel bei Zylinder)
          let winkelGrad = 360;
          let uMin = 0, uMax = 2 * Math.PI;
          try {
            const brepAdaptor = new oc.BRepAdaptor_Surface_2(face, true);
            uMin = brepAdaptor.FirstUParameter();
            uMax = brepAdaptor.LastUParameter();
            winkelGrad = Math.round(((uMax - uMin) * 180 / Math.PI) * 10) / 10;
          } catch {}

          // Hoehe aus Bounding Box der Flaeche
          const faceBbox = new oc.Bnd_Box_1();
          oc.BRepBndLib.Add(face, faceBbox, false);
          const fMin = faceBbox.CornerMin();
          const fMax = faceBbox.CornerMax();
          const dx = Math.abs(fMax.X() - fMin.X());
          const dy = Math.abs(fMax.Y() - fMin.Y());
          const dz = Math.abs(fMax.Z() - fMin.Z());
          const hoehe = Math.max(dx, dy, dz);

          // Konkav/Konvex: Face-Orientation pruefen
          // FORWARD = Normale zeigt nach aussen (konvex/Welle)
          // REVERSED = Normale zeigt nach innen (konkav/Bohrung)
          let konkav = false;
          try {
            const orient = face.Orientation_1();
            const orientVal = orient.value !== undefined ? orient.value : orient;
            // TopAbs_FORWARD=0, TopAbs_REVERSED=1
            konkav = (orientVal === 1);
          } catch {}

          const info = {
            radius: Math.round(radius * 100) / 100,
            durchmesser: Math.round(radius * 2 * 100) / 100,
            hoehe: Math.round(hoehe * 100) / 100,
            winkelGrad,
            konkav,
            typ: konkav ? 'Bohrung' : 'Welle',
            axisDir: [axisDir.X(), axisDir.Y(), axisDir.Z()],
            axisLoc: [axisLoc.X(), axisLoc.Y(), axisLoc.Z()],
            face,
          };

          if (winkelGrad >= 350) {
            rawBohrungen.push(info);
          } else {
            rawRadien.push(info);
          }
        } catch {}

      } else if (typeVal === 2) {
        // Konus
        faceTypes.konisch++;
        try {
          const cone = adaptor.Cone();
          const r1 = cone.RefRadius();
          const angle = cone.HalfAngle();

          let winkelGrad = 360;
          try {
            const brepAdaptor = new oc.BRepAdaptor_Surface_2(face, true);
            winkelGrad = Math.round(((brepAdaptor.LastUParameter() - brepAdaptor.FirstUParameter()) * 180 / Math.PI) * 10) / 10;
          } catch {}

          // Hoehe
          const faceBbox = new oc.Bnd_Box_1();
          oc.BRepBndLib.Add(face, faceBbox, false);
          const fMin = faceBbox.CornerMin();
          const fMax = faceBbox.CornerMax();
          const konHoehe = Math.max(
            Math.abs(fMax.X()-fMin.X()),
            Math.abs(fMax.Y()-fMin.Y()),
            Math.abs(fMax.Z()-fMin.Z())
          );

          const halbwinkelGrad = Math.round((Math.abs(angle) * 180 / Math.PI) * 10) / 10;

          rawKonen.push({
            radiusRef: Math.round(r1 * 100) / 100,
            halbwinkel: halbwinkelGrad,
            hoehe: Math.round(konHoehe * 100) / 100,
            winkelGrad,
            istFase: halbwinkelGrad >= 40 && halbwinkelGrad <= 50 && winkelGrad >= 350,
            istSenkung: winkelGrad >= 350,
            face,
          });
        } catch {}

      } else if (typeVal === 3) {
        faceTypes.sphaerisch++;
        try {
          const sph = adaptor.Sphere();
          const r = sph.Radius();
          rawSphaeren.push({
            radius: Math.round(r * 100) / 100,
            durchmesser: Math.round(r * 2 * 100) / 100,
          });
        } catch {}

      } else if (typeVal === 4) {
        faceTypes.toroidal++;
      } else {
        faceTypes.freiform++;
      }

    } catch {}
    faceExplorer.Next();
  }

  // Kanten zaehlen + Kantentypen analysieren (fuer Gewinde)
  let helixKanten = 0;
  const edgeExplorer = new oc.TopExp_Explorer_2(
    shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );
  while (edgeExplorer.More()) {
    edgeCount++;
    try {
      const edge = oc.TopoDS.Edge_1(edgeExplorer.Current());
      const curveAdaptor = new oc.BRepAdaptor_Curve_2(edge);
      const curveType = curveAdaptor.GetType();
      const ctVal = curveType.value !== undefined ? curveType.value : curveType;
      // GeomAbs_CurveType: 0=Line, 1=Circle, 2=Ellipse, 3=Hyperbola,
      // 4=Parabola, 5=BezierCurve, 6=BSplineCurve, 7=OffsetCurve, 8=OtherCurve
      // BSpline an Zylindern koennen Gewinde sein
      if (ctVal === 6 || ctVal === 8) helixKanten++;
    } catch {}
    edgeExplorer.Next();
  }

  // Vertices zaehlen
  const vertexExplorer = new oc.TopExp_Explorer_2(
    shape, oc.TopAbs_ShapeEnum.TopAbs_VERTEX, oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );
  while (vertexExplorer.More()) { vertexCount++; vertexExplorer.Next(); }

  // ─── Durchgangs- vs. Sacklochbohrung ───────────────────────────────────────
  for (const b of rawBohrungen) {
    // Wenn Bohrungshoehe >= 90% der Bauteilhoehe -> Durchgangsbohrung
    b.durchgang = b.hoehe >= bboxHoehe * 0.9;
  }

  // ─── Senkungen erkennen: Konus direkt ueber/unter einer Bohrung ───────────
  for (const k of rawKonen) {
    if (!k.istSenkung) continue;
    // Pruefen ob ein Zylinder mit aehnlicher Achsenposition existiert
    for (const b of rawBohrungen) {
      if (b.durchmesser <= k.radiusRef * 2 + 1 && b.durchmesser >= k.radiusRef * 2 - 5) {
        k.zuBohrung = b.durchmesser;
        b.hatSenkung = true;
        break;
      }
    }
  }

  // ─── Gewinde-Heuristik ────────────────────────────────────────────────────
  // Standard-Gewinde-Durchmesser (ISO Metrisch) in mm
  const gewindeDurchmesser = [
    { name: 'M2',   kern: 1.567, nenn: 2 },
    { name: 'M2.5', kern: 1.951, nenn: 2.5 },
    { name: 'M3',   kern: 2.387, nenn: 3 },
    { name: 'M4',   kern: 3.141, nenn: 4 },
    { name: 'M5',   kern: 4.019, nenn: 5 },
    { name: 'M6',   kern: 4.773, nenn: 6 },
    { name: 'M8',   kern: 6.466, nenn: 8 },
    { name: 'M10',  kern: 8.160, nenn: 10 },
    { name: 'M12',  kern: 9.853, nenn: 12 },
    { name: 'M14',  kern: 11.546, nenn: 14 },
    { name: 'M16',  kern: 13.546, nenn: 16 },
    { name: 'M20',  kern: 16.933, nenn: 20 },
    { name: 'M24',  kern: 20.319, nenn: 24 },
  ];

  for (const b of rawBohrungen) {
    if (!b.konkav) continue; // Nur Bohrungen (nicht Wellen)
    // Pruefen ob Durchmesser einem Kernloch-Durchmesser entspricht
    const match = gewindeDurchmesser.find(
      g => Math.abs(b.durchmesser - g.kern) < 0.3
    );
    if (match) {
      b.gewinde = match.name;
    }
  }

  // ─── Fasen erkennen: Konen mit ~45° Halbwinkel ────────────────────────────
  const fasen = rawKonen.filter(k => k.istFase);

  // ─── Kleinster Innenradius (Mindest-Werkzeugradius) ────────────────────────
  let minInnenradius = Infinity;
  for (const b of rawBohrungen) {
    if (b.konkav && b.radius < minInnenradius) minInnenradius = b.radius;
  }
  for (const r of rawRadien) {
    if (r.radius < minInnenradius) minInnenradius = r.radius;
  }
  if (minInnenradius === Infinity) minInnenradius = 0;

  // ─── Bohrungen gruppieren ─────────────────────────────────────────────────
  const bohrungenGruppiert = [];
  for (const b of rawBohrungen.sort((a, c) => a.durchmesser - c.durchmesser)) {
    const existing = bohrungenGruppiert.find(
      g => Math.abs(g.durchmesser - b.durchmesser) < 0.3 && g.konkav === b.konkav
    );
    if (existing) {
      existing.anzahl++;
      existing.hoehe = Math.max(existing.hoehe, b.hoehe);
    } else {
      const entry = {
        radius: b.radius, durchmesser: b.durchmesser, hoehe: b.hoehe,
        winkelGrad: b.winkelGrad, konkav: b.konkav, typ: b.typ,
        durchgang: b.durchgang, anzahl: 1,
      };
      if (b.gewinde) entry.gewinde = b.gewinde;
      if (b.hatSenkung) entry.hatSenkung = true;
      bohrungenGruppiert.push(entry);
    }
  }

  // Radien gruppieren
  const radienGruppiert = [];
  for (const r of rawRadien.sort((a, c) => a.durchmesser - c.durchmesser)) {
    const existing = radienGruppiert.find(
      g => Math.abs(g.durchmesser - r.durchmesser) < 0.3 && Math.abs(g.winkelGrad - r.winkelGrad) < 10
    );
    if (existing) {
      existing.anzahl++;
      existing.hoehe = Math.max(existing.hoehe, r.hoehe);
    } else {
      radienGruppiert.push({
        radius: r.radius, durchmesser: r.durchmesser, hoehe: r.hoehe,
        winkelGrad: r.winkelGrad, anzahl: 1,
      });
    }
  }

  // Fasen gruppieren
  const fasenGruppiert = [];
  for (const f of fasen) {
    const existing = fasenGruppiert.find(
      g => Math.abs(g.hoehe - f.hoehe) < 0.3 && Math.abs(g.halbwinkel - f.halbwinkel) < 3
    );
    if (existing) {
      existing.anzahl++;
    } else {
      fasenGruppiert.push({
        hoehe: f.hoehe,
        halbwinkel: f.halbwinkel,
        zuBohrung: f.zuBohrung || null,
        anzahl: 1,
      });
    }
  }

  // Senkungen (volle Konen die keine Fasen sind)
  const senkungen = rawKonen.filter(k => k.istSenkung && !k.istFase && k.zuBohrung);
  const senkungenGruppiert = [];
  for (const s of senkungen) {
    const existing = senkungenGruppiert.find(
      g => Math.abs(g.radiusRef - s.radiusRef) < 0.3
    );
    if (existing) {
      existing.anzahl++;
    } else {
      senkungenGruppiert.push({
        radiusRef: s.radiusRef,
        durchmesser: Math.round(s.radiusRef * 2 * 100) / 100,
        halbwinkel: s.halbwinkel,
        hoehe: s.hoehe,
        zuBohrung: s.zuBohrung,
        anzahl: 1,
      });
    }
  }

  return {
    features: { faces: faceCount, edges: edgeCount, vertices: vertexCount, faceTypes },
    bohrungen: bohrungenGruppiert,
    radien: radienGruppiert,
    fasen: fasenGruppiert,
    senkungen: senkungenGruppiert,
    konen: rawKonen.filter(k => !k.istFase && !k.zuBohrung).map(k => ({
      radiusRef: k.radiusRef, halbwinkel: k.halbwinkel, hoehe: k.hoehe,
    })),
    sphaeren: rawSphaeren,
    minInnenradius: Math.round(minInnenradius * 100) / 100,
    hatGewinde: rawBohrungen.some(b => b.gewinde),
    gewindeBohrungen: rawBohrungen.filter(b => b.gewinde).map(b => ({
      gewinde: b.gewinde, durchmesser: b.durchmesser, hoehe: b.hoehe,
    })),
  };
}

// ─── STEP-Metadaten aus Datei-Header auslesen ────────────────────────────────

function parseStepMetadata(uint8) {
  const text = new TextDecoder('utf-8').decode(uint8);
  const meta = {};

  // Bauteil-Name aus FILE_NAME
  const nameMatch = text.match(/FILE_NAME\s*\(\s*'([^']*)'/);
  if (nameMatch) meta.dateiname = nameMatch[1];

  // AP-Version
  const apMatch = text.match(/FILE_DESCRIPTION\s*\(\s*\(\s*'([^']*)'/);
  if (apMatch) meta.beschreibung = apMatch[1];

  // Schema
  const schemaMatch = text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/);
  if (schemaMatch) meta.schema = schemaMatch[1];

  // Erstelldatum
  const dateMatch = text.match(/FILE_NAME\s*\([^,]*,\s*'([^']*)'/);
  if (dateMatch) meta.erstelldatum = dateMatch[1];

  // CAD-System
  const cadMatch = text.match(/FILE_NAME\s*\([^,]*,[^,]*,[^,]*,[^,]*,\s*'([^']*)'/);
  if (cadMatch) meta.cadSystem = cadMatch[1];

  return meta;
}

// ─── Gewicht nach Material berechnen ─────────────────────────────────────────

function berechneGewicht(volumenMm3) {
  // Dichte in g/mm³
  const materialien = {
    'Stahl':     { dichte: 0.00785, name: 'Stahl (S235/S355)' },
    'Edelstahl': { dichte: 0.00790, name: 'Edelstahl (1.4301)' },
    'Aluminium': { dichte: 0.00270, name: 'Aluminium (AlMg3/6082)' },
    'Messing':   { dichte: 0.00850, name: 'Messing (CuZn39Pb3)' },
    'Kupfer':    { dichte: 0.00893, name: 'Kupfer' },
    'Titan':     { dichte: 0.00451, name: 'Titan (Ti6Al4V)' },
    'POM':       { dichte: 0.00142, name: 'POM (Delrin)' },
    'PA6':       { dichte: 0.00114, name: 'PA6 (Nylon)' },
  };

  const gewichte = {};
  for (const [key, mat] of Object.entries(materialien)) {
    const gewichtG = volumenMm3 * mat.dichte;
    gewichte[key] = {
      name: mat.name,
      gewichtG: Math.round(gewichtG * 100) / 100,
      gewichtKg: Math.round((gewichtG / 1000) * 1000) / 1000,
    };
  }
  return gewichte;
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

  // STEP-Metadaten aus Header parsen
  const metadaten = parseStepMetadata(uint8);

  // B-Rep Analyse versuchen
  if (oc) {
    try {
      const shape = await readStepShape(oc, uint8);
      const bbox              = computeBBoxBrep(oc, shape);
      const { volumen, oberflaeche } = computePropsBrep(oc, shape);
      const result = detectFeaturesBrep(oc, shape, bbox);
      const gewichte = berechneGewicht(volumen);

      console.log('B-Rep Analyse erfolgreich:', {
        faceTypes: result.features.faceTypes,
        bohrungen: result.bohrungen.length,
        radien: result.radien.length,
        fasen: result.fasen.length,
        senkungen: result.senkungen.length,
        gewinde: result.gewindeBohrungen.length,
        minInnenradius: result.minInnenradius,
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
        features: result.features,
        bohrungen: result.bohrungen,
        radien: result.radien,
        fasen: result.fasen,
        senkungen: result.senkungen,
        konen: result.konen,
        sphaeren: result.sphaeren,
        gewindeBohrungen: result.gewindeBohrungen,
        minInnenradius: result.minInnenradius,
        gewichte,
        metadaten,
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
  const gewichte = berechneGewicht(Math.abs(fallback.volumenMm3));
  return { ...fallback, gewichte, metadaten, mesh };
}
