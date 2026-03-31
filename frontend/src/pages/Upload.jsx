import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeStepFile } from '../services/occtService';

function Upload() {
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Datei validieren
  const validateFile = (file) => {
    const allowedExtensions = ['.step', '.stp'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`Format "${ext}" wird nicht unterstuetzt. Bitte .step oder .stp Dateien verwenden.`);
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('Datei ist groesser als 50 MB.');
    }
  };

  // STEP-Datei analysieren
  const processFile = async (file) => {
    setError(null);
    setAnalysisResult(null);
    setSelectedFile(file);

    try {
      validateFile(file);
    } catch (err) {
      setError(err.message);
      return;
    }

    setLoading(true);
    setLoadingStatus('OpenCascade WASM wird geladen...');

    try {
      setLoadingStatus('STEP-Datei wird analysiert...');
      const result = await analyzeStepFile(file);
      setAnalysisResult(result);
      setLoadingStatus('');
    } catch (err) {
      console.error('STEP-Analyse Fehler:', err);
      setError('Fehler beim Analysieren der Datei: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Drag & Drop Handler
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // Datei-Dialog oeffnen
  const handleClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  // 3D-Vorschau mit Canvas rendern
  const render3DPreview = useCallback(() => {
    if (!analysisResult?.mesh || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { vertices, indices } = analysisResult.mesh;
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    if (vertices.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Keine Mesh-Daten verfuegbar', width / 2, height / 2);
      return;
    }

    // Bounding Box fuer Zentrierung berechnen
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
      minX = Math.min(minX, vertices[i]);
      minY = Math.min(minY, vertices[i + 1]);
      minZ = Math.min(minZ, vertices[i + 2]);
      maxX = Math.max(maxX, vertices[i]);
      maxY = Math.max(maxY, vertices[i + 1]);
      maxZ = Math.max(maxZ, vertices[i + 2]);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const scale = (Math.min(width, height) * 0.7) / size;

    // Isometrische Projektion (30 Grad)
    const cosA = Math.cos(0.5);
    const sinA = Math.sin(0.5);
    const cosB = Math.cos(0.4);
    const sinB = Math.sin(0.4);

    const project = (x, y, z) => {
      const dx = x - centerX;
      const dy = y - centerY;
      const dz = z - centerZ;
      // Rotation um Y-Achse, dann X-Achse
      const rx = dx * cosA - dz * sinA;
      const ry = dy * cosB - (dx * sinA + dz * cosA) * sinB;
      return {
        px: width / 2 + rx * scale,
        py: height / 2 - ry * scale,
        depth: dy * sinB + (dx * sinA + dz * cosA) * cosB,
      };
    };

    // Dreiecke mit einfacher Beleuchtung rendern
    const triangles = [];
    for (let i = 0; i < indices.length; i += 3) {
      const i1 = indices[i] * 3;
      const i2 = indices[i + 1] * 3;
      const i3 = indices[i + 2] * 3;

      if (i1 + 2 >= vertices.length || i2 + 2 >= vertices.length || i3 + 2 >= vertices.length) continue;

      const p1 = project(vertices[i1], vertices[i1 + 1], vertices[i1 + 2]);
      const p2 = project(vertices[i2], vertices[i2 + 1], vertices[i2 + 2]);
      const p3 = project(vertices[i3], vertices[i3 + 1], vertices[i3 + 2]);

      // Normale fuer Beleuchtung berechnen
      const nx = (p2.py - p1.py) * (p3.px - p1.px) - (p2.px - p1.px) * (p3.py - p1.py);
      const avgDepth = (p1.depth + p2.depth + p3.depth) / 3;

      triangles.push({ p1, p2, p3, nx, depth: avgDepth });
    }

    // Painter's algorithm (hintere Dreiecke zuerst)
    triangles.sort((a, b) => a.depth - b.depth);

    for (const tri of triangles) {
      // Einfache Beleuchtung basierend auf Flaechennormale
      const brightness = Math.max(0.3, Math.min(1, tri.nx > 0 ? 0.8 : 0.5));
      const r = Math.round(99 * brightness);
      const g = Math.round(102 * brightness);
      const b = Math.round(241 * brightness);

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.strokeStyle = `rgba(${r - 20}, ${g - 20}, ${b - 20}, 0.3)`;
      ctx.lineWidth = 0.5;

      ctx.beginPath();
      ctx.moveTo(tri.p1.px, tri.p1.py);
      ctx.lineTo(tri.p2.px, tri.p2.py);
      ctx.lineTo(tri.p3.px, tri.p3.py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }, [analysisResult]);

  useEffect(() => {
    render3DPreview();
  }, [render3DPreview]);

  // Ergebnisse an Kalkulation uebergeben
  const handleUebernahme = () => {
    if (!analysisResult) return;
    // Daten ueber Router-State an Kalkulation uebergeben
    navigate('/kalkulation', {
      state: {
        fromUpload: true,
        dateiname: selectedFile?.name,
        laenge: analysisResult.abmessungen.laenge,
        breite: analysisResult.abmessungen.breite,
        hoehe: analysisResult.abmessungen.hoehe,
        volumenCm3: analysisResult.volumenCm3,
        features: analysisResult.features,
        bohrungen: analysisResult.bohrungen,
      },
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">STEP-Datei Analyse</h1>
        <p className="text-gray-500 mt-1">
          CAD-Dateien hochladen und automatisch mit OpenCascade analysieren
        </p>
      </div>

      {/* Verstecktes File-Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".step,.stp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-gray-50'
        }`}
      >
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p className="text-gray-700 font-medium text-lg mb-1">
          STEP/STP-Datei hierher ziehen oder klicken
        </p>
        <p className="text-sm text-gray-500">
          Unterstuetzte Formate: .step, .stp (max. 50 MB)
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Analyse erfolgt lokal im Browser mit OpenCascade (WASM)
        </p>
      </div>

      {/* Fehler-Anzeige */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          <span className="font-medium">Fehler:</span> {error}
        </div>
      )}

      {/* Ladeanzeige */}
      {loading && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">{loadingStatus}</p>
          <p className="text-sm text-gray-400 mt-1">
            Der erste Ladevorgang kann etwas laenger dauern (~10-20 Sek.)
          </p>
        </div>
      )}

      {/* Analyse-Ergebnisse */}
      {analysisResult && !loading && (
        <div className="mt-6 space-y-6">
          {/* Datei-Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="text-green-800 font-medium">{selectedFile?.name}</p>
                <p className="text-green-600 text-sm">
                  Erfolgreich analysiert ({(selectedFile?.size / 1024).toFixed(0)} KB)
                </p>
              </div>
            </div>
            <button
              onClick={handleUebernahme}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              In Kalkulation uebernehmen &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 3D-Vorschau */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">3D-Vorschau</h2>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={400}
                  className="w-full"
                  style={{ aspectRatio: '5/4' }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Isometrische Ansicht (Canvas 2D)
              </p>
            </div>

            {/* Abmessungen & Volumen */}
            <div className="space-y-6">
              {/* Bounding Box */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Abmessungen (Bounding Box)</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-indigo-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-indigo-600 font-medium">Laenge</p>
                    <p className="text-2xl font-bold text-indigo-800 mt-1">
                      {analysisResult.abmessungen.laenge}
                    </p>
                    <p className="text-xs text-indigo-500">mm</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-indigo-600 font-medium">Breite</p>
                    <p className="text-2xl font-bold text-indigo-800 mt-1">
                      {analysisResult.abmessungen.breite}
                    </p>
                    <p className="text-xs text-indigo-500">mm</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-indigo-600 font-medium">Hoehe</p>
                    <p className="text-2xl font-bold text-indigo-800 mt-1">
                      {analysisResult.abmessungen.hoehe}
                    </p>
                    <p className="text-xs text-indigo-500">mm</p>
                  </div>
                </div>
              </div>

              {/* Volumen & Oberflaeche */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Volumen & Oberflaeche</h2>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Volumen</span>
                    <span className="font-semibold text-gray-800">
                      {analysisResult.volumenCm3} cm&sup3;
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Oberflaeche</span>
                    <span className="font-semibold text-gray-800">
                      {analysisResult.oberflaecheCm2} cm&sup2;
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature-Erkennung */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Geometrische Merkmale */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Geometrische Merkmale</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-gray-800">{analysisResult.features.faces}</p>
                  <p className="text-xs text-gray-500 mt-1">Flaechen</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-gray-800">{analysisResult.features.edges}</p>
                  <p className="text-xs text-gray-500 mt-1">Kanten</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-gray-800">{analysisResult.features.vertices}</p>
                  <p className="text-xs text-gray-500 mt-1">Eckpunkte</p>
                </div>
              </div>
            </div>

            {/* Erkannte Bohrungen */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Erkannte zylindrische Flaechen
              </h2>
              {analysisResult.bohrungen.length > 0 ? (
                <div className="space-y-2">
                  {analysisResult.bohrungen.map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-lg"
                    >
                      <span className="text-sm text-amber-800">
                        Zylinder #{i + 1}
                      </span>
                      <span className="text-sm font-semibold text-amber-900">
                        &oslash; {b.durchmesser} mm
                      </span>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 mt-2">
                    Hinweis: Zylinder koennen Bohrungen, Wellen oder Rundungen sein.
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  Keine zylindrischen Flaechen erkannt.
                </p>
              )}
            </div>
          </div>

          {/* Aktions-Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleUebernahme}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Abmessungen in Kalkulation uebernehmen
            </button>
            <button
              onClick={() => {
                setAnalysisResult(null);
                setSelectedFile(null);
              }}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Neue Datei
            </button>
          </div>
        </div>
      )}

      {/* Info-Box */}
      {!analysisResult && !loading && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-800 font-medium mb-2">So funktioniert die Analyse</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>1. STEP/STP-Datei per Drag &amp; Drop oder Klick hochladen</li>
            <li>2. OpenCascade analysiert die Geometrie direkt im Browser (WASM)</li>
            <li>3. Abmessungen, Volumen und Features werden automatisch erkannt</li>
            <li>4. Ergebnisse koennen direkt in die Kalkulation uebernommen werden</li>
          </ul>
          <p className="text-xs text-blue-500 mt-3">
            Ihre Daten verlassen nicht den Browser – die gesamte Analyse erfolgt lokal.
          </p>
        </div>
      )}
    </div>
  );
}

export default Upload;
