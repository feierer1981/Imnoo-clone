import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeStepFile } from '../services/occtService';
import StepViewer from '../components/StepViewer';

function Upload() {
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
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
            {/* 3D-Vorschau mit Three.js */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">3D-Vorschau</h2>
              <StepViewer meshData={analysisResult.mesh} height={400} />
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
            {/* Flaechentypen-Uebersicht */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Flaechentypen</h2>
              {analysisResult.features.faceTypes && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {analysisResult.features.faceTypes.planar > 0 && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm text-blue-700">Planare Flaechen</span>
                      <span className="text-lg font-bold text-blue-800">{analysisResult.features.faceTypes.planar}</span>
                    </div>
                  )}
                  {analysisResult.features.faceTypes.zylindrisch > 0 && (
                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                      <span className="text-sm text-amber-700">Zylindrische</span>
                      <span className="text-lg font-bold text-amber-800">{analysisResult.features.faceTypes.zylindrisch}</span>
                    </div>
                  )}
                  {analysisResult.features.faceTypes.konisch > 0 && (
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <span className="text-sm text-orange-700">Konische</span>
                      <span className="text-lg font-bold text-orange-800">{analysisResult.features.faceTypes.konisch}</span>
                    </div>
                  )}
                  {analysisResult.features.faceTypes.sphaerisch > 0 && (
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <span className="text-sm text-purple-700">Sphaerische</span>
                      <span className="text-lg font-bold text-purple-800">{analysisResult.features.faceTypes.sphaerisch}</span>
                    </div>
                  )}
                  {analysisResult.features.faceTypes.toroidal > 0 && (
                    <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
                      <span className="text-sm text-teal-700">Toroidale</span>
                      <span className="text-lg font-bold text-teal-800">{analysisResult.features.faceTypes.toroidal}</span>
                    </div>
                  )}
                  {analysisResult.features.faceTypes.freiform > 0 && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Freiform</span>
                      <span className="text-lg font-bold text-gray-800">{analysisResult.features.faceTypes.freiform}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                <div className="text-center p-2">
                  <p className="text-2xl font-bold text-gray-800">{analysisResult.features.faces}</p>
                  <p className="text-xs text-gray-500">Flaechen</p>
                </div>
                <div className="text-center p-2">
                  <p className="text-2xl font-bold text-gray-800">{analysisResult.features.edges}</p>
                  <p className="text-xs text-gray-500">Kanten</p>
                </div>
                <div className="text-center p-2">
                  <p className="text-2xl font-bold text-gray-800">{analysisResult.features.vertices}</p>
                  <p className="text-xs text-gray-500">Vertices</p>
                </div>
              </div>
            </div>

            {/* Erkannte Geometrie-Features */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Erkannte Geometrie-Features
              </h2>

              {/* Zylinder / Bohrungen */}
              {analysisResult.bohrungen.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">
                    Zylindrische Flaechen ({analysisResult.bohrungen.length})
                  </h3>
                  <div className="space-y-1.5">
                    {analysisResult.bohrungen.map((b, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-lg text-sm"
                      >
                        <span className="text-amber-800">
                          &oslash; {b.durchmesser} mm
                          {b.anzahl > 1 && <span className="text-amber-600 ml-1">(&times;{b.anzahl})</span>}
                        </span>
                        <span className="text-amber-700">
                          H: {b.hoehe} mm
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Konen */}
              {analysisResult.konen?.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">
                    Konische Flaechen ({analysisResult.konen.length})
                  </h3>
                  <div className="space-y-1.5">
                    {analysisResult.konen.map((k, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 px-3 bg-orange-50 rounded-lg text-sm"
                      >
                        <span className="text-orange-800">Konus #{i + 1}</span>
                        <span className="text-orange-700">
                          R: {k.radiusRef} mm, Winkel: {k.halbwinkel}&deg;
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sphaeren */}
              {analysisResult.sphaeren?.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">
                    Sphaerische Flaechen ({analysisResult.sphaeren.length})
                  </h3>
                  <div className="space-y-1.5">
                    {analysisResult.sphaeren.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 px-3 bg-purple-50 rounded-lg text-sm"
                      >
                        <span className="text-purple-800">Kugel #{i + 1}</span>
                        <span className="text-purple-700">
                          &oslash; {s.durchmesser} mm
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keine Features */}
              {analysisResult.bohrungen.length === 0 &&
               (!analysisResult.konen || analysisResult.konen.length === 0) &&
               (!analysisResult.sphaeren || analysisResult.sphaeren.length === 0) && (
                <p className="text-gray-500 text-sm">
                  Nur planare und Freiform-Flaechen erkannt.
                </p>
              )}

              <p className="text-xs text-gray-400 mt-3">
                Erkennung basiert auf B-Rep Flaechenanalyse mit OpenCascade.
              </p>
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
