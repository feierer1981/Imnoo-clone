import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
const ROLLEN = ['none', 'user', 'admin'];

const rolleBadge = {
  none: 'bg-gray-100 text-gray-600',
  user: 'bg-green-100 text-green-700',
  admin: 'bg-red-100 text-red-700',
};

function Nutzer() {
  const { user: currentUser } = useAuth();
  const [nutzer, setNutzer] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    loadNutzer();
  }, []);

  const loadNutzer = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'users'), orderBy('erstelltAm', 'desc'));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNutzer(items);
    } catch (err) {
      setError('Nutzer konnten nicht geladen werden: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTestAccount = async (uid, currentValue) => {
    setUpdating(uid + '_test');
    setError(null);
    setSuccessMsg(null);
    try {
      await updateDoc(doc(db, 'users', uid), { testAccount: !currentValue });
      setNutzer((prev) =>
        prev.map((n) => (n.id === uid ? { ...n, testAccount: !currentValue } : n))
      );
      setSuccessMsg(!currentValue ? 'Testaccount aktiviert.' : 'Testaccount deaktiviert.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError('Testaccount konnte nicht geändert werden: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  const updateRolle = async (uid, newRolle) => {
    setUpdating(uid);
    setError(null);
    setSuccessMsg(null);
    try {
      // 1. Firestore aktualisieren
      await updateDoc(doc(db, 'users', uid), { rolle: newRolle });

      // 2. Custom Claims via Cloud Function synchronisieren (App Check geschützt)
      try {
        const syncUserClaims = httpsCallable(functions, 'syncUserClaims');
        await syncUserClaims({ uid, rolle: newRolle });
      } catch (syncErr) {
        console.warn('Custom Claims Sync fehlgeschlagen:', syncErr.message);
      }

      setNutzer((prev) =>
        prev.map((n) => (n.id === uid ? { ...n, rolle: newRolle } : n))
      );
      setSuccessMsg('Rolle erfolgreich aktualisiert und Custom Claims synchronisiert.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError('Rolle konnte nicht geändert werden: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const rolleKlartext = {
    none: 'Ausstehend',
    user: 'Nutzer',
    admin: 'Admin',
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nutzerübersicht</h1>
          <p className="text-gray-500 mt-1">
            Alle registrierten Nutzer und deren Rollen verwalten
          </p>
        </div>
        <button
          onClick={loadNutzer}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          <span className="font-medium">Fehler:</span> {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm">
          {successMsg}
        </div>
      )}

      {/* Statistik-Karten */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Gesamt', count: nutzer.length, color: 'text-gray-700', bg: 'bg-gray-50' },
            { label: 'Freigeschaltet', count: nutzer.filter((n) => n.rolle === 'user').length, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Ausstehend', count: nutzer.filter((n) => n.rolle === 'none').length, color: 'text-amber-700', bg: 'bg-amber-50' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl border border-gray-100 p-4`}>
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Nutzer werden geladen...</p>
        </div>
      ) : nutzer.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500">Keine Nutzer gefunden.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">E-Mail</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Registriert</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rolle</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Testaccount</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {nutzer.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-800">{n.name || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">{n.email}</td>
                  <td className="px-6 py-4 text-gray-400">{formatDate(n.erstelltAm)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${rolleBadge[n.rolle] || 'bg-gray-100 text-gray-600'}`}>
                      {rolleKlartext[n.rolle] || n.rolle}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {n.id === currentUser?.uid ? (
                      <span className="text-xs text-gray-400">–</span>
                    ) : (
                      <button
                        onClick={() => toggleTestAccount(n.id, !!n.testAccount)}
                        disabled={updating === n.id + '_test'}
                        title={n.testAccount ? 'Testaccount deaktivieren' : 'Testaccount aktivieren'}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          n.testAccount ? 'bg-amber-400' : 'bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            n.testAccount ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {n.id === currentUser?.uid ? (
                      <span className="text-xs text-gray-400 italic">Eigenes Konto</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={n.rolle}
                          disabled={updating === n.id}
                          onChange={(e) => updateRolle(n.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                        >
                          {ROLLEN.map((r) => (
                            <option key={r} value={r}>
                              {rolleKlartext[r]}
                            </option>
                          ))}
                        </select>
                        {updating === n.id && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Nutzer;
