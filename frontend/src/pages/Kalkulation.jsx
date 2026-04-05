import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { createKalkulation } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { analyzeStepFile } from '../services/occtService';
import { generatePreviewImage } from '../services/previewService';
import StepViewer from '../components/StepViewer';

const materialien = [
  'Aluminium 6061',
  'Stahl S235',
  'Edelstahl 1.4301',
  'Messing CuZn39Pb3',
  'Titan Grade 5',
];
const toleranzen = ['±0.1mm', '±0.05mm', '±0.01mm'];
const oberflaechen = ['Ra 3.2', 'Ra 1.6', 'Ra 0.8'];

const formatEur = (val) =>
  val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

// stundensatzProH: €/h aus dem Workflow (Standard 90 €/h)
function calcBauteil(item, stundensatzProH = 90) {
  const l = parseFloat(item.laenge) || 0;
  const b = parseFloat(item.breite) || 0;
  const h = parseFloat(item.hoehe) || 0;
  const stueck = parseInt(item.stueckzahl) || 1;
  const volumenCm3 = (l * b * h) / 1000;
  const maschinenlaufzeit = volumenCm3 / 50;
  const gesamtzeit = maschinenlaufzeit + 10 + 5;
  const rateProMin = stundensatzProH / 60;
  const stueckpreis = gesamtzeit * rateProMin;
  return { volumenCm3, gesamtzeit, stueckpreis, gesamtpreis: stueckpreis * stueck };
}

const maschinenLabel = { fraesen: 'Fräsen ⚙️', drehen: 'Drehen 🔄' };
const fertigungLabel = {
  einzel: 'Einzelfertigung',
  einzel_wiederkehrend: 'Einzel (wiederkehrend)',
  masse: 'Massenfertigung',
};

function makeDefaultItem(overrides = {}) {
  return {
    id: Date.now() + Math.random(),
    name: '',
    beschreibung: '',
    material: '',
    laenge: '',
    breite: '',
    hoehe: '',
    stueckzahl: 1,
    toleranz: '',
    oberflaeche: '',
    vorschauUrl: null,
    notiz: '',
    stpUrl: null,
    pdfUrl: null,
    analyse: null,
    ...overrides,
  };
}

// ─── BibliothekModal ──────────────────────────────────────────────────────────
function BibliothekModal({ uid, onAdd, onClose }) {
  const [bauteile, setBauteile] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, 'users', uid, 'bauteile'),
          orderBy('erstelltAm', 'desc')
        );
        const snap = await getDocs(q);
        setBauteile(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [uid]);

  const handleAdd = () => {
    const b = bauteile.find((x) => x.id === selected);
    if (!b) return;
    onAdd({
      name: b.name,
      laenge: String(b.analyse?.abmessungen?.laenge || ''),
      breite: String(b.analyse?.abmessungen?.breite || ''),
      hoehe: String(b.analyse?.abmessungen?.hoehe || ''),
      vorschauUrl: b.vorschauUrl || null,
      notiz: b.notizInKalkulation ? (b.notiz || '') : '',
      stpUrl: b.stpUrl || null,
      pdfUrl: b.pdfUrl || null,
      analyse: b.analyse || null,
      quellId: b.id,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-3xl"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Bauteil aus Bibliothek wählen</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : bauteile.length === 0 ? (
            <p className="text-center text-gray-500 py-12">
              Keine Bauteile in der Bibliothek gefunden.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {bauteile.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelected(b.id)}
                  className={`border-2 rounded-xl p-3 cursor-pointer transition-all ${
                    selected === b.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  }`}
                >
                  {b.vorschauUrl ? (
                    <img
                      src={b.vorschauUrl}
                      alt={b.name}
                      className="w-full h-24 object-cover rounded-lg mb-2"
                    />
                  ) : (
                    <div className="w-full h-24 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                  <p className="text-sm font-medium text-gray-800 truncate">{b.name}</p>
                  {b.analyse?.abmessungen && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {b.analyse.abmessungen.laenge}&times;{b.analyse.abmessungen.breite}&times;{b.analyse.abmessungen.hoehe} mm
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleAdd}
            disabled={!selected}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg transition-colors"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NeuesBauteilModal ────────────────────────────────────────────────────────
function NeuesBauteilModal({ onAdd, onClose }) {
  const { user } = useAuth();
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [bauteilName, setBauteilName] = useState('');
  const [notiz, setNotiz] = useState('');
  const [notizInKalkulation, setNotizInKalkulation] = useState(true);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const processFile = async (file) => {
    setError(null);
    setAnalysisResult(null);
    setSelectedFile(file);
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!['.step', '.stp'].includes(ext)) {
      setError(`Format "${ext}" wird nicht unterstützt. Bitte .step oder .stp verwenden.`);
      return;
    }
    if (file.size > 50 * 1024 * 1024) { setError('Datei ist größer als 50 MB.'); return; }
    if (!bauteilName) setBauteilName(file.name.replace(/\.(step|stp)$/i, ''));
    setLoading(true);
    setLoadingStatus('STEP-Datei wird analysiert...');
    try {
      const result = await analyzeStepFile(file);
      setAnalysisResult(result);
    } catch (err) {
      setError('Fehler beim Analysieren: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const handleSpeichern = async () => {
    if (!selectedFile || !analysisResult) return;
    if (!bauteilName.trim()) { setError('Bitte einen Bauteilnamen eingeben.'); return; }
    setSaving(true);
    setError(null);
    try {
      const uid = user.uid;
      const ts = Date.now();

      // STP hochladen
      const stpRef = ref(storage, `bauteile/${uid}/${ts}_${selectedFile.name}`);
      await uploadBytes(stpRef, selectedFile);
      const stpUrl = await getDownloadURL(stpRef);

      // PDF hochladen (optional)
      let pdfUrl = null;
      if (pdfFile) {
        const pdfRef = ref(storage, `bauteile/${uid}/${ts}_${pdfFile.name}`);
        await uploadBytes(pdfRef, pdfFile);
        pdfUrl = await getDownloadURL(pdfRef);
      }

      // Vorschaubild generieren
      let vorschauUrl = null;
      if (analysisResult.mesh) {
        try {
          const previewBlob = await generatePreviewImage(analysisResult.mesh);
          const previewRef = ref(storage, `bauteile/${uid}/${ts}_preview.jpg`);
          await uploadBytes(previewRef, previewBlob, { contentType: 'image/jpeg' });
          vorschauUrl = await getDownloadURL(previewRef);
        } catch (previewErr) {
          console.warn('Vorschaubild konnte nicht erstellt werden:', previewErr);
        }
      }

      // In Bibliothek speichern
      const analyseData = { ...analysisResult };
      delete analyseData.mesh;
      await addDoc(collection(db, 'users', uid, 'bauteile'), {
        name: bauteilName.trim(),
        dateiname: selectedFile.name,
        stpUrl,
        pdfUrl,
        pdfDateiname: pdfFile?.name || null,
        analyse: analyseData,
        notiz: notiz.trim(),
        notizInKalkulation,
        vorschauUrl,
        erstelltAm: serverTimestamp(),
      });

      // Zur Kalkulations-Liste hinzufügen (mit allen gespeicherten Daten)
      onAdd({
        name: bauteilName.trim(),
        laenge: String(analysisResult.abmessungen?.laenge || ''),
        breite: String(analysisResult.abmessungen?.breite || ''),
        hoehe: String(analysisResult.abmessungen?.hoehe || ''),
        vorschauUrl,
        notiz: notizInKalkulation ? notiz.trim() : '',
        stpUrl,
        pdfUrl,
        analyse: analyseData,
      });
      onClose();
    } catch (err) {
      setError('Fehler beim Speichern: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-800">Neues Bauteil anlegen &amp; zur Kalkulation hinzufügen</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollbarer Inhalt */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Bauteilname */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bauteilname *</label>
            <input
              type="text"
              value={bauteilName}
              onChange={(e) => setBauteilName(e.target.value)}
              placeholder="z.B. Gehäuse_V2"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Notiz */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Notiz zum Bauteil</label>
              <span className="text-xs text-gray-400">optional</span>
            </div>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="z.B. Besonderheiten, Fertigungshinweise, Materialvorgaben..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
            />
            <label className="flex items-start gap-3 mt-3 cursor-pointer group">
              <div className="relative mt-0.5 flex-shrink-0">
                <input type="checkbox" checked={notizInKalkulation} onChange={(e) => setNotizInKalkulation(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${notizInKalkulation ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 group-hover:border-indigo-400'}`}>
                  {notizInKalkulation && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-700">Text in Kalkulation einbinden</p>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">Empfohlen</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Die Notiz wird als Prompt in der Kalkulation verwendet.</p>
              </div>
            </label>
            {!notizInKalkulation && notiz.trim() && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-amber-700">Die Notiz wird gespeichert, aber <strong>nicht</strong> in der Kalkulation berücksichtigt.</p>
              </div>
            )}
          </div>

          {/* Upload-Bereiche */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* STP */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">STEP/STP-Datei *</label>
              <input ref={fileInputRef} type="file" accept=".step,.stp" className="hidden"
                onChange={(e) => { if (e.target.files[0]) processFile(e.target.files[0]); }} />
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-indigo-500 bg-indigo-50' : selectedFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                }`}
              >
                {selectedFile ? (
                  <>
                    <svg className="w-8 h-8 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-green-700 font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-green-600 mt-1">({(selectedFile.size / 1024).toFixed(0)} KB) – Klicken zum Ändern</p>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <p className="text-gray-700 font-medium text-sm">STEP/STP hierher ziehen</p>
                    <p className="text-xs text-gray-500 mt-1">oder klicken (max. 50 MB)</p>
                  </>
                )}
              </div>
            </div>

            {/* PDF */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PDF-Zeichnung (optional)</label>
              <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden"
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  if (!f.name.toLowerCase().endsWith('.pdf')) { setError('Bitte eine PDF-Datei wählen.'); return; }
                  if (f.size > 20 * 1024 * 1024) { setError('PDF ist größer als 20 MB.'); return; }
                  setPdfFile(f); setError(null);
                }} />
              <div
                onClick={() => pdfInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${pdfFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}
              >
                {pdfFile ? (
                  <>
                    <svg className="w-8 h-8 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-green-700 font-medium text-sm">{pdfFile.name}</p>
                    <p className="text-xs text-green-600 mt-1">({(pdfFile.size / 1024).toFixed(0)} KB) – Klicken zum Ändern</p>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-700 font-medium text-sm">PDF-Zeichnung hochladen</p>
                    <p className="text-xs text-gray-500 mt-1">Klicken zum Auswählen (max. 20 MB)</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Ladeanzeige */}
          {loading && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
              <p className="mt-3 text-gray-600 font-medium text-sm">{loadingStatus}</p>
              <p className="text-xs text-gray-400 mt-1">Der erste Ladevorgang kann ~10–20 Sek. dauern</p>
            </div>
          )}

          {/* Fehler */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              <span className="font-medium">Fehler:</span> {error}
            </div>
          )}

          {/* Analyse-Ergebnisse */}
          {analysisResult && !loading && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-green-800 font-medium text-sm">{selectedFile?.name} – erfolgreich analysiert</p>
                  <div className="flex gap-4 text-xs text-green-700 mt-0.5">
                    <span>L: {analysisResult.abmessungen.laenge} mm</span>
                    <span>B: {analysisResult.abmessungen.breite} mm</span>
                    <span>H: {analysisResult.abmessungen.hoehe} mm</span>
                    <span>Vol: {analysisResult.volumenCm3} cm&sup3;</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">3D-Vorschau</h3>
                  <StepViewer meshData={analysisResult.mesh} height={250} />
                </div>
                <div className="space-y-3">
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Abmessungen</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {['laenge', 'breite', 'hoehe'].map((k) => (
                        <div key={k} className="bg-indigo-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-indigo-600 font-medium">{k.charAt(0).toUpperCase() + k.slice(1)}</p>
                          <p className="text-xl font-bold text-indigo-800">{analysisResult.abmessungen[k]}</p>
                          <p className="text-xs text-indigo-500">mm</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">Volumen &amp; Oberfläche</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-500">Volumen</span>
                        <span className="font-semibold text-gray-800">{analysisResult.volumenCm3} cm&sup3;</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-gray-500">Oberfläche</span>
                        <span className="font-semibold text-gray-800">{analysisResult.oberflaecheCm2} cm&sup2;</span>
                      </div>
                    </div>
                  </div>
                  {analysisResult.bohrungen?.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">Zylindrische Flächen ({analysisResult.bohrungen.length})</h3>
                      <div className="space-y-1">
                        {analysisResult.bohrungen.map((b, i) => (
                          <div key={i} className="flex justify-between text-xs py-1 px-2 bg-amber-50 rounded">
                            <span className="text-amber-800">&oslash; {b.durchmesser} mm{b.anzahl > 1 && ` ×${b.anzahl}`}</span>
                            <span className="text-amber-700">H: {b.hoehe} mm</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Abbrechen
          </button>
          <button
            onClick={handleSpeichern}
            disabled={!analysisResult || loading || saving}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white flex-shrink-0" />
                Wird gespeichert...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                In Bibliothek speichern &amp; hinzufügen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BauteilKarte ─────────────────────────────────────────────────────────────
function BauteilKarte({ item, index, onChange, onRemove, stundensatz }) {
  const calc = calcBauteil(item, stundensatz);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header: Thumbnail + Name + Preis + Entfernen */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-100">
        {item.vorschauUrl ? (
          <img
            src={item.vorschauUrl}
            alt={item.name}
            className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={item.name}
            onChange={(e) => onChange(index, 'name', e.target.value)}
            placeholder="Bauteilname"
            className="w-full text-sm font-semibold text-gray-800 border-0 p-0 focus:outline-none bg-transparent"
          />
          <p className="text-xs text-gray-400 mt-0.5">
            {item.laenge && item.breite && item.hoehe
              ? `${item.laenge} × ${item.breite} × ${item.hoehe} mm`
              : 'Abmessungen eingeben'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-400">Gesamt</p>
            <p className="text-lg font-bold text-indigo-700">{formatEur(calc.gesamtpreis)}</p>
          </div>
          <button
            onClick={() => onRemove(index)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Bauteil entfernen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Parameter-Zeile */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Material</label>
          <select
            value={item.material}
            onChange={(e) => onChange(index, 'material', e.target.value)}
            className={`w-full border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 ${!item.material ? 'border-amber-300 text-gray-400' : 'border-gray-200'}`}
          >
            <option value="">– von KI ermitteln –</option>
            {materialien.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Stückzahl</label>
          <input
            type="number"
            value={item.stueckzahl}
            onChange={(e) => onChange(index, 'stueckzahl', e.target.value)}
            min="1"
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Toleranz</label>
          <select
            value={item.toleranz}
            onChange={(e) => onChange(index, 'toleranz', e.target.value)}
            className={`w-full border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 ${!item.toleranz ? 'border-amber-300 text-gray-400' : 'border-gray-200'}`}
          >
            <option value="">– von KI ermitteln –</option>
            {toleranzen.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Oberfläche</label>
          <select
            value={item.oberflaeche}
            onChange={(e) => onChange(index, 'oberflaeche', e.target.value)}
            className={`w-full border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 ${!item.oberflaeche ? 'border-amber-300 text-gray-400' : 'border-gray-200'}`}
          >
            <option value="">– von KI ermitteln –</option>
            {oberflaechen.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Abmessungen */}
      <div className="px-4 pb-4 grid grid-cols-3 md:grid-cols-4 gap-3">
        {[
          { key: 'laenge', label: 'Länge (mm)' },
          { key: 'breite', label: 'Breite (mm)' },
          { key: 'hoehe', label: 'Höhe (mm)' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <input
              type="number"
              value={item[key]}
              onChange={(e) => onChange(index, key, e.target.value)}
              min="0"
              placeholder="0"
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        ))}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Stückpreis</label>
          <div className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 text-gray-700 font-medium">
            {formatEur(calc.stueckpreis)}
          </div>
        </div>
      </div>

      {/* Notiz */}
      <div className="px-4 pb-4">
        <label className="block text-xs text-gray-500 mb-1">Notiz</label>
        <textarea
          value={item.notiz || ''}
          onChange={(e) => onChange(index, 'notiz', e.target.value)}
          placeholder="Fertigungshinweise, Besonderheiten..."
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y"
        />
      </div>
    </div>
  );
}

// ─── Kalkulation (Hauptkomponente) ────────────────────────────────────────────
function Kalkulation() {
  const { user } = useAuth();
  const location = useLocation();
  const storageKey = `kalk_bauteile_${user?.uid || 'guest'}`;
  const workflowStorageKey = `kalk_workflow_${user?.uid || 'guest'}`;

  const [bauteileList, setBauteileList] = useState(() => {
    try {
      const stored = localStorage.getItem(`kalk_bauteile_${user?.uid || 'guest'}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(() => {
    try { return localStorage.getItem(`kalk_workflow_${user?.uid || 'guest'}`) || ''; } catch { return ''; }
  });
  const [workflows, setWorkflows] = useState([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [gespeichert, setGespeichert] = useState(false);
  const [showBibliothek, setShowBibliothek] = useState(false);
  const [showNeuesBauteil, setShowNeuesBauteil] = useState(false);

  // Bauteile-Liste im localStorage speichern
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(bauteileList));
    } catch { /* Quota-Fehler ignorieren */ }
  }, [bauteileList, storageKey]);

  // Workflow-Auswahl im localStorage speichern
  useEffect(() => {
    try { localStorage.setItem(workflowStorageKey, selectedWorkflowId); } catch {}
  }, [selectedWorkflowId, workflowStorageKey]);

  // Workflows laden
  useEffect(() => {
    async function loadWorkflows() {
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'workflows'));
        setWorkflows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setWorkflowsLoading(false);
      }
    }
    loadWorkflows();
  }, [user.uid]);

  // Daten aus NeuesBauteil "In Kalkulation" Button übernehmen
  useEffect(() => {
    const state = location.state;
    if (state?.fromUpload) {
      setBauteileList((prev) => [
        ...prev,
        makeDefaultItem({
          name: state.dateiname?.replace(/\.[^.]+$/, '') || '',
          laenge: String(state.laenge || ''),
          breite: String(state.breite || ''),
          hoehe: String(state.hoehe || ''),
        }),
      ]);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const handleChange = (index, field, value) => {
    setBauteileList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemove = (index) => {
    setBauteileList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdd = (overrides) => {
    setBauteileList((prev) => [...prev, makeDefaultItem({ ...overrides, id: Date.now() + Math.random() })]);
  };

  const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId) || null;
  const stundensatz = parseFloat(selectedWorkflow?.maschinenstundensatz) || 90;

  const gesamtpreis = bauteileList.reduce(
    (sum, item) => sum + calcBauteil(item, stundensatz).gesamtpreis,
    0
  );

  const handleSpeichern = async () => {
    if (bauteileList.length === 0) return;
    try {
      await createKalkulation({
        bauteile: bauteileList.map((item) => ({ ...item, ...calcBauteil(item, stundensatz) })),
        gesamtpreis,
        workflowId: selectedWorkflowId || null,
        workflow: selectedWorkflow ? { ...selectedWorkflow } : null,
        uid: user?.uid || null,
      });
      setGespeichert(true);
      setTimeout(() => setGespeichert(false), 3000);
    } catch (err) {
      alert('Fehler beim Speichern: ' + err.message);
    }
  };

  return (
    <div>
      {/* Seitenkopf */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Kalkulation</h1>
          <p className="text-gray-500 mt-1">CNC-Fertigungskosten berechnen</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBibliothek(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Aus Bibliothek
          </button>
          <button
            onClick={() => setShowNeuesBauteil(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neues Bauteil
          </button>
        </div>
      </div>

      {/* Workflow-Auswahl */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Workflow wählen</p>
              <p className="text-xs text-gray-400">Maschinenausstattung und Stundensatz für diese Kalkulation</p>
            </div>
          </div>
          {workflowsLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
          ) : workflows.length === 0 ? (
            <Link
              to="/einstellungen"
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              Workflow anlegen
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <select
              value={selectedWorkflowId}
              onChange={(e) => setSelectedWorkflowId(e.target.value)}
              className={`border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[220px] ${
                !selectedWorkflowId ? 'border-amber-300 text-gray-400' : 'border-gray-300 text-gray-800'
              }`}
            >
              <option value="">– Workflow wählen –</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          )}
        </div>
        {selectedWorkflow && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
            {selectedWorkflow.maschinentyp && (
              <span>Maschine: <strong className="text-gray-700">{maschinenLabel[selectedWorkflow.maschinentyp]}</strong></span>
            )}
            {selectedWorkflow.maschinenstundensatz && (
              <span>Stundensatz: <strong className="text-gray-700">{selectedWorkflow.maschinenstundensatz} €/h</strong></span>
            )}
            {selectedWorkflow.fertigungstyp && (
              <span>Fertigung: <strong className="text-gray-700">{fertigungLabel[selectedWorkflow.fertigungstyp]}</strong></span>
            )}
            {selectedWorkflow.ncProgramm && (
              <span>NC: <strong className="text-gray-700">{{ manuell: 'Manuell', cam: 'CAM', archiv: 'Aus Archiv' }[selectedWorkflow.ncProgramm]}</strong></span>
            )}
            {(selectedWorkflow.maxBauteilLaenge || selectedWorkflow.maxBauteilBreite) && (
              <span>Max. Bauteil: <strong className="text-gray-700">{selectedWorkflow.maxBauteilLaenge}×{selectedWorkflow.maxBauteilBreite}×{selectedWorkflow.maxBauteilHoehe} mm</strong></span>
            )}
          </div>
        )}
      </div>

      {bauteileList.length === 0 ? (
        /* Leer-Zustand */
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="text-gray-500 font-medium mb-2">Keine Bauteile hinzugefügt</h3>
          <p className="text-gray-400 text-sm mb-6">
            Wählen Sie Bauteile aus der Bibliothek oder laden Sie ein neues STEP-Modell hoch.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowBibliothek(true)}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Aus Bibliothek
            </button>
            <button
              onClick={() => setShowNeuesBauteil(true)}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Neues Bauteil hochladen
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bauteil-Liste */}
          <div className="lg:col-span-2 space-y-4">
            {bauteileList.map((item, index) => (
              <BauteilKarte
                key={item.id}
                item={item}
                index={index}
                onChange={handleChange}
                onRemove={handleRemove}
                stundensatz={stundensatz}
              />
            ))}

            {/* Weitere Bauteile hinzufügen */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowBibliothek(true)}
                className="py-3 border-2 border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Aus Bibliothek
              </button>
              <button
                onClick={() => setShowNeuesBauteil(true)}
                className="py-3 border-2 border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Neues Bauteil
              </button>
            </div>
          </div>

          {/* Gesamtergebnis (rechte Seite) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Kalkulations-Ergebnis</h2>

              <div className="space-y-2 text-sm mb-4">
                {bauteileList.map((item, index) => {
                  const calc = calcBauteil(item, stundensatz);
                  return (
                    <div key={item.id} className="flex justify-between items-center text-gray-600">
                      <span className="truncate max-w-[60%] text-gray-700">
                        {item.name || `Bauteil ${index + 1}`}
                      </span>
                      <span className="font-medium text-gray-800 flex-shrink-0 ml-2">
                        {formatEur(calc.gesamtpreis)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="bg-indigo-50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-indigo-800 font-semibold">Gesamtpreis</span>
                    <span className="text-2xl font-bold text-indigo-700">
                      {formatEur(gesamtpreis)}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-500 mt-1">
                    {bauteileList.length} {bauteileList.length === 1 ? 'Bauteil' : 'Bauteile'} · {stundensatz} €/h
                  </p>
                </div>
              </div>

              {gespeichert && (
                <div className="mt-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">
                  Kalkulation erfolgreich gespeichert!
                </div>
              )}

              <button
                onClick={handleSpeichern}
                disabled={bauteileList.length === 0}
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
              >
                Angebot erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showBibliothek && (
        <BibliothekModal
          uid={user?.uid}
          onAdd={handleAdd}
          onClose={() => setShowBibliothek(false)}
        />
      )}
      {showNeuesBauteil && (
        <NeuesBauteilModal
          onAdd={handleAdd}
          onClose={() => setShowNeuesBauteil(false)}
        />
      )}
    </div>
  );
}

export default Kalkulation;
