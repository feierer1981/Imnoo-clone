import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { createKalkulation } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { analyzeStepFile } from '../services/occtService';

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

function calcBauteil(item) {
  const l = parseFloat(item.laenge) || 0;
  const b = parseFloat(item.breite) || 0;
  const h = parseFloat(item.hoehe) || 0;
  const stueck = parseInt(item.stueckzahl) || 1;
  const volumenCm3 = (l * b * h) / 1000;
  const maschinenlaufzeit = volumenCm3 / 50;
  const gesamtzeit = maschinenlaufzeit + 10 + 5;
  const stueckpreis = gesamtzeit * 1.5;
  return { volumenCm3, gesamtzeit, stueckpreis, gesamtpreis: stueckpreis * stueck };
}

function makeDefaultItem(overrides = {}) {
  return {
    id: Date.now() + Math.random(),
    name: '',
    beschreibung: '',
    material: materialien[0],
    laenge: '',
    breite: '',
    hoehe: '',
    stueckzahl: 1,
    toleranz: toleranzen[0],
    oberflaeche: oberflaechen[0],
    vorschauUrl: null,
    notiz: '',
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
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [bauteilName, setBauteilName] = useState('');
  const fileInputRef = useRef(null);

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
    if (file.size > 50 * 1024 * 1024) {
      setError('Datei ist größer als 50 MB.');
      return;
    }
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

  const handleAdd = () => {
    if (!analysisResult) return;
    onAdd({
      name: bauteilName || selectedFile?.name?.replace(/\.(step|stp)$/i, '') || 'Neues Bauteil',
      laenge: String(analysisResult.abmessungen?.laenge || ''),
      breite: String(analysisResult.abmessungen?.breite || ''),
      hoehe: String(analysisResult.abmessungen?.hoehe || ''),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Neues Bauteil analysieren</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bauteilname</label>
            <input
              type="text"
              value={bauteilName}
              onChange={(e) => setBauteilName(e.target.value)}
              placeholder="z.B. Gehäuse_V2"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".step,.stp"
            className="hidden"
            onChange={(e) => { if (e.target.files[0]) processFile(e.target.files[0]); }}
          />
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-indigo-500 bg-indigo-50'
                : selectedFile
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
            }`}
          >
            {selectedFile ? (
              <>
                <svg className="w-8 h-8 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-700 font-medium text-sm">{selectedFile.name}</p>
                <p className="text-xs text-green-500 mt-1">Klicken zum Ändern</p>
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

          {loading && (
            <div className="flex items-center gap-3 bg-indigo-50 rounded-lg p-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 flex-shrink-0" />
              <p className="text-sm text-indigo-700">{loadingStatus}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
          )}

          {analysisResult && !loading && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-800 font-medium text-sm mb-1">Analyse abgeschlossen</p>
              <div className="flex gap-4 text-xs text-green-700">
                <span>L: {analysisResult.abmessungen.laenge} mm</span>
                <span>B: {analysisResult.abmessungen.breite} mm</span>
                <span>H: {analysisResult.abmessungen.hoehe} mm</span>
                <span>Vol: {analysisResult.volumenCm3} cm&sup3;</span>
              </div>
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
            disabled={!analysisResult || loading}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg transition-colors"
          >
            Zur Kalkulation hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BauteilKarte ─────────────────────────────────────────────────────────────
function BauteilKarte({ item, index, onChange, onRemove }) {
  const calc = calcBauteil(item);

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
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
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
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {toleranzen.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Oberfläche</label>
          <select
            value={item.oberflaeche}
            onChange={(e) => onChange(index, 'oberflaeche', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
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

      {/* Notiz (wenn vorhanden) */}
      {item.notiz && (
        <div className="px-4 pb-4">
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800">
            <span className="font-medium">Notiz: </span>{item.notiz}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kalkulation (Hauptkomponente) ────────────────────────────────────────────
function Kalkulation() {
  const { user } = useAuth();
  const location = useLocation();
  const [bauteileList, setBauteileList] = useState([]);
  const [gespeichert, setGespeichert] = useState(false);
  const [showBibliothek, setShowBibliothek] = useState(false);
  const [showNeuesBauteil, setShowNeuesBauteil] = useState(false);

  // Daten aus NeuesBauteil "In Kalkulation" Button übernehmen
  useEffect(() => {
    const state = location.state;
    if (state?.fromUpload) {
      setBauteileList([
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

  const gesamtpreis = bauteileList.reduce(
    (sum, item) => sum + calcBauteil(item).gesamtpreis,
    0
  );

  const handleSpeichern = async () => {
    if (bauteileList.length === 0) return;
    try {
      await createKalkulation({
        bauteile: bauteileList.map((item) => ({ ...item, ...calcBauteil(item) })),
        gesamtpreis,
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
                  const calc = calcBauteil(item);
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
                    {bauteileList.length} {bauteileList.length === 1 ? 'Bauteil' : 'Bauteile'}
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
