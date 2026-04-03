import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { analyzeStepFile } from '../services/occtService';
import StepViewer from '../components/StepViewer';

function NeuesBauteil() {
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [bauteilName, setBauteilName] = useState('');
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  const validateStepFile = (file) => {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!['.step', '.stp'].includes(ext)) {
      throw new Error(`Format "${ext}" wird nicht unterstuetzt. Bitte .step oder .stp Dateien verwenden.`);
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('Datei ist groesser als 50 MB.');
    }
  };

  const processFile = async (file) => {
    setError(null);
    setAnalysisResult(null);
    setSelectedFile(file);

    try {
      validateStepFile(file);
    } catch (err) {
      setError(err.message);
      return;
    }

    // Bauteilname aus Dateiname vorbelegen
    if (!bauteilName) {
      const nameWithoutExt = file.name.replace(/\.(step|stp)$/i, '');
      setBauteilName(nameWithoutExt);
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

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };
  const handleClick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handlePdfChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('Bitte eine PDF-Datei auswaehlen.');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError('PDF ist groesser als 20 MB.');
        return;
      }
      setPdfFile(file);
      setError(null);
    }
  };

  const handleSpeichern = async () => {
    if (!selectedFile || !analysisResult) return;
    if (!bauteilName.trim()) {
      setError('Bitte einen Bauteilnamen eingeben.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const userId = auth.currentUser?.uid || 'anonymous';
      const ts = Date.now();

      // STP in Storage hochladen
      const stpRef = ref(storage, `bauteile/${userId}/${ts}_${selectedFile.name}`);
      await uploadBytes(stpRef, selectedFile);
      const stpUrl = await getDownloadURL(stpRef);

      // PDF in Storage hochladen (optional)
      let pdfUrl = null;
      if (pdfFile) {
        const pdfRef = ref(storage, `bauteile/${userId}/${ts}_${pdfFile.name}`);
        await uploadBytes(pdfRef, pdfFile);
        pdfUrl = await getDownloadURL(pdfRef);
      }

      // Analysedaten fuer Firestore vorbereiten (ohne mesh - zu gross)
      const analyseData = { ...analysisResult };
      delete analyseData.mesh;

      // Bauteil in Firestore speichern
      await addDoc(collection(db, 'bauteile'), {
        name: bauteilName.trim(),
        dateiname: selectedFile.name,
        stpUrl,
        pdfUrl,
        pdfDateiname: pdfFile?.name || null,
        userId,
        analyse: analyseData,
        erstelltAm: serverTimestamp(),
      });

      navigate('/bibliothek');
    } catch (err) {
      console.error('Speichern Fehler:', err);
      setError('Fehler beim Speichern: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUebernahme = () => {
    if (!analysisResult) return;
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
        <h1 className="text-2xl font-bold text-gray-800">Neues Bauteil anlegen</h1>
        <p className="text-gray-500 mt-1">
          STEP-Datei und optionale PDF-Zeichnung hochladen, analysieren und speichern
        </p>
      </div>

      {/* Bauteilname */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Bauteilname</label>
        <input
          type="text"
          value={bauteilName}
          onChange={(e) => setBauteilName(e.target.value)}
          placeholder="z.B. Gehaeuse_V2"
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
      </div>

      {/* Upload-Bereiche */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* STEP Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">STEP/STP-Datei *</label>
          <input ref={fileInputRef} type="file" accept=".step,.stp" className="hidden" onChange={handleFileChange} />
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragOver
                ? 'border-indigo-500 bg-indigo-50'
                : selectedFile
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-gray-50'
            }`}
          >
            {selectedFile ? (
              <>
                <svg className="w-10 h-10 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-700 font-medium">{selectedFile.name}</p>
                <p className="text-xs text-green-600 mt-1">({(selectedFile.size / 1024).toFixed(0)} KB) - Klicken zum Aendern</p>
              </>
            ) : (
              <>
                <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="text-gray-700 font-medium">STEP/STP hierher ziehen</p>
                <p className="text-xs text-gray-500 mt-1">oder klicken (max. 50 MB)</p>
              </>
            )}
          </div>
        </div>

        {/* PDF Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PDF-Zeichnung (optional)</label>
          <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfChange} />
          <div
            onClick={() => pdfInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              pdfFile
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-gray-50'
            }`}
          >
            {pdfFile ? (
              <>
                <svg className="w-10 h-10 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-700 font-medium">{pdfFile.name}</p>
                <p className="text-xs text-green-600 mt-1">({(pdfFile.size / 1024).toFixed(0)} KB) - Klicken zum Aendern</p>
              </>
            ) : (
              <>
                <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-700 font-medium">PDF-Zeichnung hochladen</p>
                <p className="text-xs text-gray-500 mt-1">Klicken zum Auswaehlen (max. 20 MB)</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fehler */}
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
          <p className="text-sm text-gray-400 mt-1">Der erste Ladevorgang kann etwas laenger dauern (~10-20 Sek.)</p>
        </div>
      )}

      {/* Analyse-Ergebnisse */}
      {analysisResult && !loading && (
        <div className="mt-6 space-y-6">
          {/* Datei-Info + Speichern */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="text-green-800 font-medium">{selectedFile?.name}</p>
                <p className="text-green-600 text-sm">Erfolgreich analysiert ({(selectedFile?.size / 1024).toFixed(0)} KB)</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSpeichern}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Speichert...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Bauteil speichern
                  </>
                )}
              </button>
              <button
                onClick={handleUebernahme}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                In Kalkulation &rarr;
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 3D-Vorschau */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">3D-Vorschau</h2>
              <StepViewer meshData={analysisResult.mesh} height={400} />
            </div>

            {/* Abmessungen */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Abmessungen (Bounding Box)</h2>
                <div className="grid grid-cols-3 gap-4">
                  {['laenge', 'breite', 'hoehe'].map((key) => (
                    <div key={key} className="bg-indigo-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-indigo-600 font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}</p>
                      <p className="text-2xl font-bold text-indigo-800 mt-1">{analysisResult.abmessungen[key]}</p>
                      <p className="text-xs text-indigo-500">mm</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Volumen &amp; Oberflaeche</h2>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Volumen</span>
                    <span className="font-semibold text-gray-800">{analysisResult.volumenCm3} cm&sup3;</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Oberflaeche</span>
                    <span className="font-semibold text-gray-800">{analysisResult.oberflaecheCm2} cm&sup2;</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature-Erkennung */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Flaechentypen</h2>
              {analysisResult.features.faceTypes && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { key: 'planar', label: 'Planare Flaechen', color: 'blue' },
                    { key: 'zylindrisch', label: 'Zylindrische', color: 'amber' },
                    { key: 'konisch', label: 'Konische', color: 'orange' },
                    { key: 'sphaerisch', label: 'Sphaerische', color: 'purple' },
                    { key: 'toroidal', label: 'Toroidale', color: 'teal' },
                    { key: 'freiform', label: 'Freiform', color: 'gray' },
                  ].map(({ key, label, color }) =>
                    analysisResult.features.faceTypes[key] > 0 ? (
                      <div key={key} className={`flex items-center justify-between p-3 bg-${color}-50 rounded-lg`}>
                        <span className={`text-sm text-${color}-700`}>{label}</span>
                        <span className={`text-lg font-bold text-${color}-800`}>{analysisResult.features.faceTypes[key]}</span>
                      </div>
                    ) : null
                  )}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                {[
                  { val: analysisResult.features.faces, label: 'Flaechen' },
                  { val: analysisResult.features.edges, label: 'Kanten' },
                  { val: analysisResult.features.vertices, label: 'Vertices' },
                ].map(({ val, label }) => (
                  <div key={label} className="text-center p-2">
                    <p className="text-2xl font-bold text-gray-800">{val}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Erkannte Geometrie-Features</h2>

              {analysisResult.bohrungen?.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Zylindrische Flaechen ({analysisResult.bohrungen.length})</h3>
                  <div className="space-y-1.5">
                    {analysisResult.bohrungen.map((b, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-lg text-sm">
                        <span className="text-amber-800">
                          &oslash; {b.durchmesser} mm
                          {b.anzahl > 1 && <span className="text-amber-600 ml-1">(&times;{b.anzahl})</span>}
                        </span>
                        <span className="text-amber-700">H: {b.hoehe} mm</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysisResult.konen?.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Konische Flaechen ({analysisResult.konen.length})</h3>
                  <div className="space-y-1.5">
                    {analysisResult.konen.map((k, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 bg-orange-50 rounded-lg text-sm">
                        <span className="text-orange-800">Konus #{i + 1}</span>
                        <span className="text-orange-700">R: {k.radiusRef} mm, Winkel: {k.halbwinkel}&deg;</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysisResult.sphaeren?.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Sphaerische Flaechen ({analysisResult.sphaeren.length})</h3>
                  <div className="space-y-1.5">
                    {analysisResult.sphaeren.map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 bg-purple-50 rounded-lg text-sm">
                        <span className="text-purple-800">Kugel #{i + 1}</span>
                        <span className="text-purple-700">&oslash; {s.durchmesser} mm</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!analysisResult.bohrungen || analysisResult.bohrungen.length === 0) &&
               (!analysisResult.konen || analysisResult.konen.length === 0) &&
               (!analysisResult.sphaeren || analysisResult.sphaeren.length === 0) && (
                <p className="text-gray-500 text-sm">Nur planare und Freiform-Flaechen erkannt.</p>
              )}

              <p className="text-xs text-gray-400 mt-3">Erkennung basiert auf B-Rep Flaechenanalyse mit OpenCascade.</p>
            </div>
          </div>

          {/* Aktions-Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleSpeichern}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {saving ? 'Wird gespeichert...' : 'Bauteil speichern'}
            </button>
            <button
              onClick={handleUebernahme}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              In Kalkulation uebernehmen
            </button>
            <button
              onClick={() => { setAnalysisResult(null); setSelectedFile(null); setPdfFile(null); setBauteilName(''); }}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Zuruecksetzen
            </button>
          </div>
        </div>
      )}

      {/* Info-Box */}
      {!analysisResult && !loading && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-800 font-medium mb-2">So funktioniert es</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>1. Bauteilname eingeben</li>
            <li>2. STEP/STP-Datei per Drag &amp; Drop oder Klick hochladen</li>
            <li>3. Optional: PDF-Zeichnung hinzufuegen</li>
            <li>4. Analyse-Ergebnisse pruefen und Bauteil speichern</li>
            <li>5. Gespeicherte Bauteile in der Bibliothek wiederfinden</li>
          </ul>
          <p className="text-xs text-blue-500 mt-3">
            Die STEP-Analyse erfolgt lokal im Browser mit OpenCascade (WASM).
          </p>
        </div>
      )}
    </div>
  );
}

export default NeuesBauteil;
