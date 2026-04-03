import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../../firebase';

function Bibliotheken() {
  const [nutzer, setNutzer] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [bauteile, setBauteile] = useState([]);
  const [nutzerLoading, setNutzerLoading] = useState(true);
  const [bauteilLoading, setBauteilLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadNutzer();
  }, []);

  const loadNutzer = async () => {
    setNutzerLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'users'), orderBy('erstelltAm', 'desc'));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNutzer(items);
    } catch (err) {
      setError('Nutzer konnten nicht geladen werden: ' + err.message);
    } finally {
      setNutzerLoading(false);
    }
  };

  const loadBauteile = async (userId) => {
    setBauteilLoading(true);
    setError(null);
    setBauteile([]);
    try {
      const q = query(
        collection(db, 'users', userId, 'bauteile'),
        orderBy('erstelltAm', 'desc')
      );
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBauteile(items);
    } catch (err) {
      setError('Bibliothek konnte nicht geladen werden: ' + err.message);
    } finally {
      setBauteilLoading(false);
    }
  };

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    setConfirmDelete(null);
    loadBauteile(u.id);
  };

  const handleDelete = async (bauteilId) => {
    if (!selectedUser) return;
    setDeleting(bauteilId);
    setError(null);
    try {
      await deleteDoc(doc(db, 'users', selectedUser.id, 'bauteile', bauteilId));
      setBauteile((prev) => prev.filter((b) => b.id !== bauteilId));
      setConfirmDelete(null);
    } catch (err) {
      setError('Bauteil konnte nicht gelöscht werden: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const rolleBadge = {
    none: 'bg-gray-100 text-gray-500',
    user: 'bg-green-100 text-green-700',
    admin: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Kundenbibliotheken</h1>
        <p className="text-gray-500 mt-1">
          Gespeicherte Bauteile aller Nutzer einsehen und verwalten
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          <span className="font-medium">Fehler:</span> {error}
        </div>
      )}

      <div className="flex gap-6">
        {/* Nutzerliste */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Nutzer auswählen</h2>
            </div>
            {nutzerLoading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 max-h-[calc(100vh-280px)] overflow-y-auto">
                {nutzer.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleSelectUser(n)}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-indigo-50 ${
                        selectedUser?.id === n.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-800 truncate">{n.name || n.email}</p>
                      <p className="text-xs text-gray-400 truncate">{n.email}</p>
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${rolleBadge[n.rolle] || 'bg-gray-100 text-gray-500'}`}>
                        {n.rolle}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Bibliothek des ausgewählten Nutzers */}
        <div className="flex-1">
          {!selectedUser ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-400 text-sm">Wähle links einen Nutzer aus, um dessen Bibliothek anzuzeigen.</p>
            </div>
          ) : bauteilLoading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-500 text-sm">Bibliothek wird geladen...</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Bibliothek von{' '}
                    <span className="text-indigo-600">{selectedUser.name || selectedUser.email}</span>
                  </h2>
                  <p className="text-sm text-gray-400">{bauteile.length} Bauteile gespeichert</p>
                </div>
                <button
                  onClick={() => loadBauteile(selectedUser.id)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Aktualisieren
                </button>
              </div>

              {bauteile.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                  <p className="text-gray-400 text-sm">Dieser Nutzer hat noch keine Bauteile gespeichert.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {bauteile.map((bt) => (
                    <div key={bt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-800 truncate">{bt.name}</h3>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{bt.dateiname}</p>
                        </div>
                        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{formatDate(bt.erstelltAm)}</span>
                      </div>

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
                          <span className="font-medium text-gray-700">{bt.analyse.volumenCm3} cm³</span>
                        </div>
                      )}

                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                        {bt.stpUrl && (
                          <a href={bt.stpUrl} target="_blank" rel="noopener noreferrer"
                            className="flex-1 text-center text-xs py-1.5 px-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium transition-colors">
                            STP herunterladen
                          </a>
                        )}
                        {bt.pdfUrl && (
                          <a href={bt.pdfUrl} target="_blank" rel="noopener noreferrer"
                            className="flex-1 text-center text-xs py-1.5 px-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 font-medium transition-colors">
                            PDF anzeigen
                          </a>
                        )}
                        {confirmDelete === bt.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDelete(bt.id)}
                              disabled={deleting === bt.id}
                              className="text-xs py-1.5 px-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
                            >
                              {deleting === bt.id ? '...' : 'Löschen'}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs py-1.5 px-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                            >
                              Abbrechen
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(bt.id)}
                            className="text-xs py-1.5 px-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium transition-colors"
                          >
                            Löschen
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Bibliotheken;
