// OpenCascade STEP-Analyse-Service
// Nutzt opencascade.js (WASM) zum Parsen und Analysieren von STEP-Dateien im Browser

let ocInstance = null;

/**
 * OpenCascade WASM-Instanz laden (Singleton)
 * Wird nur beim ersten Aufruf initialisiert, danach gecacht
 */
export async function initOCCT() {
  if (ocInstance) return ocInstance;

  const { initOpenCascade } = await import('opencascade.js');
  ocInstance = await initOpenCascade();
  console.log('OpenCascade WASM geladen');
  return ocInstance;
}

/**
 * STEP-Datei einlesen und als OpenCascade Shape zurueckgeben
 * @param {File} file - Die hochgeladene STEP/STP-Datei
 * @returns {Object} OpenCascade TopoDS_Shape
 */
async function readStepFile(oc, file) {
  // STEP ist ein Textformat – als Text einlesen
  const text = await file.text();

  // Sicheren Dateinamen ohne Sonderzeichen verwenden
  const filename = 'upload.step';
  oc.FS.writeFile(filename, text);

  // STEP-Reader konfigurieren und Datei einlesen
  const reader = new oc.STEPControl_Reader_1();
  const status = reader.ReadFile(filename);

  // Enum-Vergleich: In opencascade.js muessen .value verglichen werden
  const done = oc.IFSelect_ReturnStatus.IFSelect_RetDone;
  if (status.value !== undefined ? status.value !== done.value : status !== done) {
    oc.FS.unlink(filename);
    console.error('STEP ReadFile status:', status);
    throw new Error('STEP-Datei konnte nicht gelesen werden. Bitte Format pruefen.');
  }

  // Alle Wurzeln uebertragen und Shape erstellen
  reader.TransferRoots(new oc.Message_ProgressRange_1());
  const shape = reader.OneShape();

  // Temporaere Datei aufraeumen
  oc.FS.unlink(filename);

  return shape;
}

/**
 * Bounding Box eines Shapes berechnen
 * Gibt Abmessungen in mm zurueck
 */
function getBoundingBox(oc, shape) {
  const bbox = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bbox, false);

  // CornerMin/CornerMax liefert gp_Pnt Objekte in opencascade.js
  const min = bbox.CornerMin();
  const max = bbox.CornerMax();

  return {
    laenge: Math.abs(max.X() - min.X()),
    breite: Math.abs(max.Y() - min.Y()),
    hoehe: Math.abs(max.Z() - min.Z()),
  };
}

/**
 * Volumen eines Shapes mit GProp berechnen
 * @returns {number} Volumen in mm³
 */
function getVolume(oc, shape) {
  const props = new oc.GProp_GProps_1();
  oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
  return props.Mass(); // Volumen in mm³
}

/**
 * Oberflaeche eines Shapes berechnen
 * @returns {number} Oberflaeche in mm²
 */
function getSurfaceArea(oc, shape) {
  const props = new oc.GProp_GProps_1();
  oc.BRepGProp.SurfaceProperties_1(shape, props, false, false);
  return props.Mass(); // Flaeche in mm²
}

/**
 * Geometrische Features zaehlen (Flaechen, Kanten, Vertices)
 */
function countFeatures(oc, shape) {
  let faces = 0;
  let edges = 0;
  let vertices = 0;

  // Flaechen zaehlen
  const faceExplorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );
  while (faceExplorer.More()) {
    faces++;
    faceExplorer.Next();
  }

  // Kanten zaehlen
  const edgeExplorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );
  while (edgeExplorer.More()) {
    edges++;
    edgeExplorer.Next();
  }

  // Vertices zaehlen
  const vertexExplorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_VERTEX,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );
  while (vertexExplorer.More()) {
    vertices++;
    vertexExplorer.Next();
  }

  return { faces, edges, vertices };
}

/**
 * Zylindrische Flaechen erkennen (potenzielle Bohrungen)
 * Gibt Anzahl und Liste der Radien zurueck
 */
function detectCylinders(oc, shape) {
  const cylinders = [];

  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  while (explorer.More()) {
    try {
      const face = oc.TopoDS.Face_1(explorer.Current());
      const surface = oc.BRep_Tool.Surface_2(face);

      // Typ der Flaeche pruefen
      const geomSurf = surface.get();
      const typeName = geomSurf.DynamicType().get().Name();

      if (typeName.includes('Cylindrical')) {
        // Durchmesser ueber Bounding Box der Flaeche schaetzen
        const faceBbox = new oc.Bnd_Box_1();
        oc.BRepBndLib.Add(face, faceBbox, false);
        const fMin = faceBbox.CornerMin();
        const fMax = faceBbox.CornerMax();

        const dx = Math.abs(fMax.X() - fMin.X());
        const dy = Math.abs(fMax.Y() - fMin.Y());
        const dz = Math.abs(fMax.Z() - fMin.Z());
        // Die zwei kleinsten Dimensionen definieren den Durchmesser
        const dims = [dx, dy, dz].sort((a, b) => a - b);
        const estimatedDiameter = dims[0];

        if (estimatedDiameter > 0.5) {
          cylinders.push({
            durchmesser: Math.round(estimatedDiameter * 100) / 100,
          });
        }
      }
    } catch {
      // Flaeche konnte nicht analysiert werden, ueberspringen
    }
    explorer.Next();
  }

  return cylinders;
}

/**
 * Shape zu Dreiecks-Mesh konvertieren fuer 3D-Vorschau
 * Gibt Vertices und Indices als Float32Arrays zurueck
 */
export function triangulateShape(oc, shape) {
  const vertices = [];
  const indices = [];

  // Mesh erzeugen
  new oc.BRepMesh_IncrementalMesh_2(shape, 0.5, false, 0.5, true);

  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  let vertexOffset = 0;

  while (explorer.More()) {
    try {
      const face = oc.TopoDS.Face_1(explorer.Current());
      const location = new oc.TopLoc_Location_1();
      const triangulation = oc.BRep_Tool.Triangulation(face, location, 0);

      if (!triangulation.IsNull()) {
        const tri = triangulation.get();
        const nbNodes = tri.NbNodes();
        const nbTriangles = tri.NbTriangles();

        // Vertices auslesen
        for (let i = 1; i <= nbNodes; i++) {
          const node = tri.Node(i);
          vertices.push(node.X(), node.Y(), node.Z());
        }

        // Dreiecks-Indizes auslesen
        for (let i = 1; i <= nbTriangles; i++) {
          const triangle = tri.Triangle(i);
          const orientation = face.Orientation_1();
          const revEnum = oc.TopAbs_Orientation.TopAbs_REVERSED;
          const reversed = orientation.value !== undefined
            ? orientation.value === revEnum.value
            : orientation === revEnum;

          const i1 = triangle.Value(1) - 1 + vertexOffset;
          const i2 = triangle.Value(2) - 1 + vertexOffset;
          const i3 = triangle.Value(3) - 1 + vertexOffset;

          if (reversed) {
            indices.push(i1, i3, i2);
          } else {
            indices.push(i1, i2, i3);
          }
        }

        vertexOffset += nbNodes;
      }
    } catch {
      // Flaeche konnte nicht trianguliert werden
    }
    explorer.Next();
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}

/**
 * Hauptfunktion: STEP-Datei komplett analysieren
 * Gibt alle extrahierten Informationen zurueck
 */
export async function analyzeStepFile(file) {
  const oc = await initOCCT();

  // STEP-Datei einlesen
  const shape = await readStepFile(oc, file);

  // Jede Analyse einzeln ausfuehren, damit ein Fehler nicht alles blockiert
  let boundingBox = { laenge: 0, breite: 0, hoehe: 0 };
  let volumen = 0;
  let oberflaeche = 0;
  let features = { faces: 0, edges: 0, vertices: 0 };
  let bohrungen = [];
  let mesh = { vertices: new Float32Array(0), indices: new Uint32Array(0) };

  try { boundingBox = getBoundingBox(oc, shape); }
  catch (e) { console.warn('BoundingBox Fehler:', e); }

  try { volumen = getVolume(oc, shape); }
  catch (e) { console.warn('Volumen Fehler:', e); }

  try { oberflaeche = getSurfaceArea(oc, shape); }
  catch (e) { console.warn('Oberflaeche Fehler:', e); }

  try { features = countFeatures(oc, shape); }
  catch (e) { console.warn('Features Fehler:', e); }

  try { bohrungen = detectCylinders(oc, shape); }
  catch (e) { console.warn('Zylinder-Erkennung Fehler:', e); }

  try { mesh = triangulateShape(oc, shape); }
  catch (e) { console.warn('Triangulation Fehler:', e); }

  return {
    abmessungen: {
      laenge: Math.round(boundingBox.laenge * 100) / 100,
      breite: Math.round(boundingBox.breite * 100) / 100,
      hoehe: Math.round(boundingBox.hoehe * 100) / 100,
    },
    volumenMm3: Math.round(Math.abs(volumen) * 100) / 100,
    volumenCm3: Math.round((Math.abs(volumen) / 1000) * 100) / 100,
    oberflaecheMm2: Math.round(Math.abs(oberflaeche) * 100) / 100,
    oberflaecheCm2: Math.round((Math.abs(oberflaeche) / 100) * 100) / 100,
    features,
    bohrungen,
    mesh,
  };
}
