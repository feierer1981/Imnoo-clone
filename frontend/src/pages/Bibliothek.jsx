import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { analyzeStepFile } from '../services/occtService';
import StepViewer from '../components/StepViewer';

// Extrahiert den Storage-Pfad aus einer Firebase-Download-URL
function getStoragePath(url) {
  try {
    const match = url?.match(/\/o\/(.+?)\?/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

async function deleteStorageFile(url) {
  const path = getStoragePath(url);
  if (path) {
    try { await deleteObject(ref(storage, path)); } catch { /* ignorieren */ }
  }
}

// ─── PDF-Vorschau Modal ───────────────────────────────────────────────────────
function PdfModal({ bauteil, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl" style={{ height: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">{bauteil.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{bauteil.dateiname}</p>
          </div>
          <div className="flex items-center gap-3">
            <a href={bauteil.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium text-orange-600 hover:text-orange-800 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Vollbild öffnen
            </a>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <iframe src={bauteil.pdfUrl} className="flex-1 w-full rounded-b-xl" title={`PDF – ${bauteil.name}`} />
      </div>
    </div>
  );
}

// ─── 3D-Viewer Modal ─────────────────────────────────────────────────────────
function StepViewerModal({ bauteil, onClose }) {
  const [meshData, setMeshData] = useState(null);
  const [status, setStatus] = useState('STP-Datei wird geladen...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setStatus('STP-Datei wird geladen...');
        const response = await fetch(bauteil.stpUrl);
        if (!response.ok) throw new Error('Download fehlgeschlagen');
        const blob = await response.blob();
        const file = new File([blob], bauteil.dateiname, { type: 'application/octet-stream' });

        setStatus('OpenCascade WASM wird initialisiert...');
        const result = await analyzeStepFile(file);
        if (!cancelled) setMeshData(result.mesh);
      } catch (err) {
        if (!cancelled) setError('3D-Modell konnte nicht geladen werden: ' + err.message);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [bauteil]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl"
        style={{ height: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">{bauteil.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{bauteil.dateiname}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Inhalt */}
        <div className="flex-1 p-5 overflow-hidden">
          {error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            </div>
          ) : !meshData ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">{status}</p>
                <p className="text-gray-400 text-sm mt-1">
                  Erster Ladevorgang kann 10–20 Sekunden dauern
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full">
              <StepViewer meshData={meshData} height={window.innerHeight * 0.9 - 120} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bearbeiten-Modal ─────────────────────────────────────────────────────────
function EditModal({ bauteil, onClose, onSaved }) {
  const { user } = useAuth();
  const [notiz, setNotiz] = useState(bauteil.notiz || '');
  const [notizInKalkulation, setNotizInKalkulation] = useState(bauteil.notizInKalkulation || false);
  const [newPdf, setNewPdf] = useState(null);
  const [newStp, setNewStp] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const pdfRef = useRef(null);
  const stpRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const uid = user.uid;
      const ts = Date.now();
      const updates = { notiz, notizInKalkulation };

      if (newPdf) {
        // Alte PDF löschen
        await deleteStorageFile(bauteil.pdfUrl);
        const pdfStorageRef = ref(storage, `bauteile/${uid}/${ts}_${newPdf.name}`);
        await uploadBytes(pdfStorageRef, newPdf);
        updates.pdfUrl = await getDownloadURL(pdfStorageRef);
        updates.pdfDateiname = newPdf.name;
      }

      if (newStp) {
        // Alte STP löschen
        await deleteStorageFile(bauteil.stpUrl);
        const stpStorageRef = ref(storage, `bauteile/${uid}/${ts}_${newStp.name}`);
        await uploadBytes(stpStorageRef, newStp);
        updates.stpUrl = await getDownloadURL(stpStorageRef);
        updates.dateiname = newStp.name;
      }

      await updateDoc(doc(db, 'users', uid, 'bauteile', bauteil.id), updates);
      onSaved({ ...bauteil, ...updates });
    } catch (err) {
      setError('Speichern fehlgeschlagen: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Bauteil bearbeiten</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
          )}

          {/* Bauteilname (nur anzeigen) */}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Bauteil</p>
            <p className="font-medium text-gray-800">{bauteil.name}</p>
            <p className="text-xs text-gray-400">{bauteil.dateiname}</p>
          </div>

          {/* Notiz */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="Notiz zum Bauteil eingeben..."
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
            />
          </div>

          {/* Notiz in Kalkulation einbinden */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={notizInKalkulation}
                onChange={(e) => setNotizInKalkulation(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                notizInKalkulation ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 group-hover:border-indigo-400'
              }`}>
                {notizInKalkulation && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Text in Kalkulation einbinden</p>
              <p className="text-xs text-gray-400 mt-0.5">Diese Notiz wird später in der Kalkulation verwendet</p>
            </div>
          </label>

          {/* Dateien ersetzen */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Dateien ersetzen</p>
            <div className="space-y-2">
              {/* PDF ersetzen */}
              <input ref={pdfRef} type="file" accept=".pdf" className="hidden"
                onChange={(e) => { const f = e.target.files[0]; if (f) setNewPdf(f); }} />
              <button onClick={() => pdfRef.current?.click()}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  newPdf ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-600'
                }`}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="flex-1 text-left truncate">
                  {newPdf ? `✓ ${newPdf.name}` : `PDF ersetzen${bauteil.pdfDateiname ? ` (aktuell: ${bauteil.pdfDateiname})` : ''}`}
                </span>
              </button>

              {/* STP ersetzen */}
              <input ref={stpRef} type="file" accept=".step,.stp" className="hidden"
                onChange={(e) => { const f = e.target.files[0]; if (f) setNewStp(f); }} />
              <button onClick={() => stpRef.current?.click()}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  newStp ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-600'
                }`}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="flex-1 text-left truncate">
                  {newStp ? `✓ ${newStp.name}` : `STP ersetzen (aktuell: ${bauteil.dateiname})`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────
function Bibliothek() {
  const { user } = useAuth();
  const [bauteile, setBauteile] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suchbegriff, setSuchbegriff] = useState('');
  const [previewBauteil, setPreviewBauteil] = useState(null);
  const [viewerBauteil, setViewerBauteil] = useState(null);
  const [editBauteil, setEditBauteil] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { loadBauteile(); }, [user?.uid]);

  const loadBauteile = async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'users', user.uid, 'bauteile'), orderBy('erstelltAm', 'desc'));
      const snapshot = await getDocs(q);
      setBauteile(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setError('Bauteile konnten nicht geladen werden: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (bt) => {
    setDeleting(bt.id);
    setError(null);
    try {
      await deleteStorageFile(bt.stpUrl);
      await deleteStorageFile(bt.pdfUrl);
      await deleteDoc(doc(db, 'users', user.uid, 'bauteile', bt.id));
      setBauteile((prev) => prev.filter((b) => b.id !== bt.id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError('Löschen fehlgeschlagen: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleSaved = (updated) => {
    setBauteile((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setEditBauteil(null);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const gefilterteBauteile = bauteile.filter((bt) => {
    if (!suchbegriff.trim()) return true;
    const q = suchbegriff.toLowerCase();
    return bt.name?.toLowerCase().includes(q) || bt.dateiname?.toLowerCase().includes(q);
  });

  return (
    <div>
      {previewBauteil && <PdfModal bauteil={previewBauteil} onClose={() => setPreviewBauteil(null)} />}
      {viewerBauteil && <StepViewerModal bauteil={viewerBauteil} onClose={() => setViewerBauteil(null)} />}
      {editBauteil && <EditModal bauteil={editBauteil} onClose={() => setEditBauteil(null)} onSaved={handleSaved} />}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bibliothek</h1>
          <p className="text-gray-500 mt-1">Gespeicherte Bauteile verwalten</p>
        </div>
        <button onClick={loadBauteile} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aktualisieren
        </button>
      </div>

      {/* Suche */}
      {!loading && bauteile.length > 0 && (
        <div className="mb-5 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={suchbegriff}
            onChange={(e) => setSuchbegriff(e.target.value)}
            placeholder="Bauteile suchen..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
          {suchbegriff && (
            <button onClick={() => setSuchbegriff('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          <span className="font-medium">Fehler:</span> {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-500">Bauteile werden geladen...</p>
        </div>
      ) : bauteile.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-gray-500 text-lg font-medium">Noch keine Bauteile gespeichert</p>
          <p className="text-gray-400 text-sm mt-1">Erstelle ein neues Bauteil unter &quot;Neues Bauteil&quot; in der Seitenleiste.</p>
        </div>
      ) : gefilterteBauteile.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500">Keine Bauteile für &ldquo;{suchbegriff}&rdquo; gefunden.</p>
          <button onClick={() => setSuchbegriff('')} className="mt-2 text-sm text-indigo-600 hover:text-indigo-800">Suche zurücksetzen</button>
        </div>
      ) : (
        <>
          {suchbegriff && (
            <p className="text-sm text-gray-400 mb-4">{gefilterteBauteile.length} von {bauteile.length} Bauteilen</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {gefilterteBauteile.map((bt) => (
              <div key={bt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col">
                {/* PDF-Thumbnail */}
                {bt.pdfUrl ? (
                  <button onClick={() => setPreviewBauteil(bt)}
                    className="relative w-full overflow-hidden rounded-t-xl bg-gray-50 border-b border-gray-100 group"
                    style={{ height: '180px' }} title="PDF Vorschau öffnen">
                    <iframe src={`${bt.pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                      className="w-full h-full pointer-events-none" title={`Vorschau ${bt.name}`} scrolling="no" />
                    <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-indigo-700 text-sm font-medium px-3 py-1.5 rounded-lg shadow flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Vorschau öffnen
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="w-full rounded-t-xl bg-gray-50 border-b border-gray-100 flex items-center justify-center" style={{ height: '180px' }}>
                    <div className="text-center text-gray-300">
                      <svg className="w-10 h-10 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-xs">Kein PDF verfügbar</p>
                    </div>
                  </div>
                )}

                {/* Karteninhalt */}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 mr-2">
                      <h3 className="font-semibold text-gray-800 text-lg leading-tight">{bt.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{bt.dateiname}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(bt.erstelltAm)}</span>
                  </div>

                  {/* Abmessungen */}
                  {bt.analyse?.abmessungen && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {['laenge', 'breite', 'hoehe'].map((key) => (
                        <div key={key} className="bg-indigo-50 rounded p-2 text-center">
                          <p className="text-xs text-indigo-600">{key.charAt(0).toUpperCase() + key.slice(1)}</p>
                          <p className="text-sm font-bold text-indigo-800">{bt.analyse.abmessungen[key]} mm</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {bt.analyse?.volumenCm3 && (
                    <div className="flex justify-between text-sm py-1.5 border-t border-gray-100">
                      <span className="text-gray-500">Volumen</span>
                      <span className="font-medium text-gray-700">{bt.analyse.volumenCm3} cm&sup3;</span>
                    </div>
                  )}

                  {bt.analyse?.features && (
                    <div className="flex gap-3 text-xs text-gray-500 py-1.5 border-t border-gray-100">
                      <span>{bt.analyse.features.faces} Flächen</span>
                      <span>{bt.analyse.features.edges} Kanten</span>
                    </div>
                  )}

                  {/* Notiz */}
                  {bt.notiz && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <p className="text-xs text-gray-600 line-clamp-2 flex-1">{bt.notiz}</p>
                      </div>
                      {bt.notizInKalkulation && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          In Kalkulation einbinden
                        </span>
                      )}
                    </div>
                  )}

                  {/* Aktionen */}
                  <div className="mt-auto pt-3 space-y-2">
                    <div className="flex gap-2">
                      {bt.pdfUrl && (
                        <button onClick={() => setPreviewBauteil(bt)}
                          className="flex-1 text-center text-sm py-2 px-3 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 font-medium transition-colors flex items-center justify-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          PDF Vorschau
                        </button>
                      )}
                      {bt.stpUrl && (
                        <a href={bt.stpUrl} target="_blank" rel="noopener noreferrer"
                          className="flex-1 text-center text-sm py-2 px-3 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium transition-colors">
                          STP laden
                        </a>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {bt.stpUrl && (
                        <button onClick={() => setViewerBauteil(bt)}
                          className="flex-1 text-sm py-2 px-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors flex items-center justify-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          3D Modell
                        </button>
                      )}
                      <button onClick={() => setEditBauteil(bt)}
                        className="flex-1 text-sm py-2 px-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors flex items-center justify-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Bearbeiten
                      </button>

                      {confirmDeleteId === bt.id ? (
                        <div className="flex gap-1 flex-1">
                          <button onClick={() => handleDelete(bt)} disabled={deleting === bt.id}
                            className="flex-1 text-sm py-2 px-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50">
                            {deleting === bt.id ? '...' : 'Bestätigen'}
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="text-sm py-2 px-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                            Nein
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(bt.id)}
                          className="text-sm py-2 px-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium transition-colors flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Löschen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Bibliothek;
