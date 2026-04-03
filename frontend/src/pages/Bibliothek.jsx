import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

function PdfModal({ bauteil, onClose }) {
  // Schließen mit Escape-Taste
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl"
        style={{ height: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal-Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">{bauteil.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{bauteil.dateiname}</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={bauteil.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-orange-600 hover:text-orange-800 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Vollbild öffnen
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF-Einbettung */}
        <iframe
          src={bauteil.pdfUrl}
          className="flex-1 w-full rounded-b-xl"
          title={`PDF Vorschau – ${bauteil.name}`}
        />
      </div>
    </div>
  );
}

function Bibliothek() {
  const { user } = useAuth();
  const [bauteile, setBauteile] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewBauteil, setPreviewBauteil] = useState(null);

  useEffect(() => {
    loadBauteile();
  }, [user?.uid]);

  const loadBauteile = async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'users', user.uid, 'bauteile'), orderBy('erstelltAm', 'desc'));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setBauteile(items);
    } catch (err) {
      console.error('Laden fehlgeschlagen:', err);
      setError('Bauteile konnten nicht geladen werden: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      {previewBauteil && (
        <PdfModal bauteil={previewBauteil} onClose={() => setPreviewBauteil(null)} />
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bibliothek</h1>
          <p className="text-gray-500 mt-1">Gespeicherte Bauteile verwalten</p>
        </div>
        <button
          onClick={loadBauteile}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          <span className="font-medium">Fehler:</span> {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Bauteile werden geladen...</p>
        </div>
      ) : bauteile.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-gray-500 text-lg font-medium">Noch keine Bauteile gespeichert</p>
          <p className="text-gray-400 text-sm mt-1">
            Erstelle ein neues Bauteil unter &quot;Neues Bauteil&quot; in der Seitenleiste.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {bauteile.map((bt) => (
            <div key={bt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col">
              {/* PDF-Vorschau als Thumbnail oben in der Karte */}
              {bt.pdfUrl ? (
                <button
                  onClick={() => setPreviewBauteil(bt)}
                  className="relative w-full overflow-hidden rounded-t-xl bg-gray-50 border-b border-gray-100 group"
                  style={{ height: '180px' }}
                  title="PDF Vorschau öffnen"
                >
                  <iframe
                    src={`${bt.pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    className="w-full h-full pointer-events-none"
                    title={`Vorschau ${bt.name}`}
                    scrolling="no"
                  />
                  {/* Hover-Overlay */}
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-xs">Kein PDF verfügbar</p>
                  </div>
                </div>
              )}

              {/* Karteninhalt */}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-lg">{bt.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{bt.dateiname}</p>
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(bt.erstelltAm)}</span>
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

                {/* Volumen */}
                {bt.analyse?.volumenCm3 && (
                  <div className="flex justify-between text-sm py-1.5 border-t border-gray-100">
                    <span className="text-gray-500">Volumen</span>
                    <span className="font-medium text-gray-700">{bt.analyse.volumenCm3} cm&sup3;</span>
                  </div>
                )}

                {/* Features */}
                {bt.analyse?.features && (
                  <div className="flex gap-3 text-xs text-gray-500 py-1.5 border-t border-gray-100">
                    <span>{bt.analyse.features.faces} Flächen</span>
                    <span>{bt.analyse.features.edges} Kanten</span>
                  </div>
                )}

                {/* Aktionen */}
                <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100">
                  {bt.pdfUrl && (
                    <button
                      onClick={() => setPreviewBauteil(bt)}
                      className="flex-1 text-center text-sm py-2 px-3 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      PDF Vorschau
                    </button>
                  )}
                  {bt.stpUrl && (
                    <a
                      href={bt.stpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center text-sm py-2 px-3 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium transition-colors"
                    >
                      STP herunterladen
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Bibliothek;
