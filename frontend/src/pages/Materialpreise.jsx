import { useState, useEffect } from 'react';
import {
  collection, getDocs, setDoc, deleteDoc, doc, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

// ─── Standard-Materialliste ───────────────────────────────────────────────────
const DEFAULT_MATERIALIEN = [
  { werkstoff: 'Baustahl',        bezeichnung: 'S235JR (1.0038)',           dichte: 7850, preis: 2.20 },
  { werkstoff: 'Baustahl',        bezeichnung: 'S355JR (1.0045)',           dichte: 7850, preis: 2.50 },
  { werkstoff: 'Automatenstahl',  bezeichnung: '11SMn30 (1.0715)',          dichte: 7850, preis: 3.20 },
  { werkstoff: 'Vergütungsstahl', bezeichnung: 'C45 (1.0503)',              dichte: 7850, preis: 3.50 },
  { werkstoff: 'Edelstahl',       bezeichnung: '1.4301 (V2A)',              dichte: 7900, preis: 7.50 },
  { werkstoff: 'Edelstahl',       bezeichnung: '1.4404 (V4A)',              dichte: 8000, preis: 10.00 },
  { werkstoff: 'Aluminium',       bezeichnung: 'AlMg3 (3.3535)',            dichte: 2650, preis: 8.00 },
  { werkstoff: 'Aluminium',       bezeichnung: 'AlMg4,5Mn (5083 / 3.3547)',dichte: 2660, preis: 9.00 },
  { werkstoff: 'Aluminium',       bezeichnung: 'EN AW-7075 (3.4365)',       dichte: 2810, preis: 14.00 },
  { werkstoff: 'Messing',         bezeichnung: 'CuZn39Pb3 (2.0401)',        dichte: 8500, preis: 9.00 },
  { werkstoff: 'Kupfer',          bezeichnung: 'E-Cu (2.0060)',             dichte: 8940, preis: 15.00 },
  { werkstoff: 'Titan',           bezeichnung: 'Grade 2 (3.7035)',          dichte: 4510, preis: 45.00 },
  { werkstoff: 'Titan',           bezeichnung: 'Ti6Al4V (3.7165)',          dichte: 4430, preis: 70.00 },
  { werkstoff: 'Kunststoff',      bezeichnung: 'POM-C',                     dichte: 1410, preis: 8.00 },
  { werkstoff: 'Kunststoff',      bezeichnung: 'PA6',                       dichte: 1150, preis: 6.00 },
  { werkstoff: 'Kunststoff',      bezeichnung: 'PE-HD',                     dichte: 950,  preis: 5.00 },
  { werkstoff: 'Kunststoff',      bezeichnung: 'PTFE',                      dichte: 2200, preis: 30.00 },
];

const emptyForm = { werkstoff: '', bezeichnung: '', dichte: '', preis: '' };

function Materialpreise() {
  const { user } = useAuth();
  const [materialien, setMaterialien] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState({});    // id → true wenn geändert
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  const colRef = () => collection(db, 'users', user.uid, 'materialien');

  // Laden & ggf. seeden
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const snap = await getDocs(colRef());
      if (snap.empty) {
        await seedDefaults();
      } else {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        items.sort((a, b) => a.werkstoff.localeCompare(b.werkstoff) || a.bezeichnung.localeCompare(b.bezeichnung));
        setMaterialien(items);
      }
      setLoading(false);
    })();
  }, [user]);

  const seedDefaults = async () => {
    const batch = writeBatch(db);
    const items = [];
    DEFAULT_MATERIALIEN.forEach((m, i) => {
      const ref = doc(colRef());
      const data = { ...m, istStandard: true, sortOrder: i };
      batch.set(ref, data);
      items.push({ id: ref.id, ...data });
    });
    await batch.commit();
    setMaterialien(items);
  };

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // Preis / Dichte inline ändern
  const handleChange = (id, field, value) => {
    setMaterialien(prev =>
      prev.map(m => m.id === id ? { ...m, [field]: value } : m)
    );
    setChanged(prev => ({ ...prev, [id]: true }));
  };

  // Einzelne Zeile speichern
  const handleSave = async (item) => {
    setSaving(true);
    try {
      const { id, ...data } = item;
      data.preis = parseFloat(String(data.preis).replace(',', '.')) || 0;
      data.dichte = parseInt(data.dichte) || 0;
      await setDoc(doc(db, 'users', user.uid, 'materialien', id), data);
      setChanged(prev => { const n = { ...prev }; delete n[id]; return n; });
      showToast('Gespeichert');
    } catch {
      showToast('Fehler beim Speichern', false);
    } finally {
      setSaving(false);
    }
  };

  // Alle geänderten Zeilen auf einmal speichern
  const handleSaveAll = async () => {
    const toSave = materialien.filter(m => changed[m.id]);
    if (!toSave.length) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      toSave.forEach(({ id, ...data }) => {
        data.preis = parseFloat(String(data.preis).replace(',', '.')) || 0;
        data.dichte = parseInt(data.dichte) || 0;
        batch.set(doc(db, 'users', user.uid, 'materialien', id), data);
      });
      await batch.commit();
      setChanged({});
      showToast(`${toSave.length} Einträge gespeichert`);
    } catch {
      showToast('Fehler beim Speichern', false);
    } finally {
      setSaving(false);
    }
  };

  // Zeile löschen
  const handleDelete = async (id) => {
    if (!window.confirm('Dieses Material wirklich löschen?')) return;
    await deleteDoc(doc(db, 'users', user.uid, 'materialien', id));
    setMaterialien(prev => prev.filter(m => m.id !== id));
    setChanged(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  // Neues Material hinzufügen
  const handleAdd = async () => {
    if (!form.werkstoff.trim() || !form.bezeichnung.trim()) return;
    setSaving(true);
    try {
      const data = {
        werkstoff: form.werkstoff.trim(),
        bezeichnung: form.bezeichnung.trim(),
        dichte: parseInt(form.dichte) || 0,
        preis: parseFloat(String(form.preis).replace(',', '.')) || 0,
        istStandard: false,
        sortOrder: materialien.length,
      };
      const ref = doc(colRef());
      await setDoc(ref, data);
      setMaterialien(prev => [...prev, { id: ref.id, ...data }].sort(
        (a, b) => a.werkstoff.localeCompare(b.werkstoff) || a.bezeichnung.localeCompare(b.bezeichnung)
      ));
      setForm(emptyForm);
      setShowAdd(false);
      showToast('Material hinzugefügt');
    } catch {
      showToast('Fehler beim Hinzufügen', false);
    } finally {
      setSaving(false);
    }
  };

  // Auf Standard zurücksetzen
  const handleReset = async () => {
    setSaving(true);
    try {
      // Alle löschen
      const batch1 = writeBatch(db);
      materialien.forEach(m => batch1.delete(doc(db, 'users', user.uid, 'materialien', m.id)));
      await batch1.commit();
      setMaterialien([]);
      setChanged({});
      await seedDefaults();
      setResetConfirm(false);
      showToast('Standardliste wiederhergestellt');
    } catch {
      showToast('Fehler beim Zurücksetzen', false);
    } finally {
      setSaving(false);
    }
  };

  const changedCount = Object.keys(changed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Materialpreise</h1>
          <p className="text-gray-500 mt-1">Deine persönliche Werkstoffliste — Preise individuell anpassbar</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {changedCount > 0 && (
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Speichert…' : `Alle speichern (${changedCount})`}
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neues Material
          </button>
          <button
            onClick={() => setResetConfirm(true)}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-500 text-sm rounded-lg transition-colors"
            title="Auf Standardliste zurücksetzen"
          >
            ↺ Standard
          </button>
        </div>
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Werkstoff</th>
                <th className="px-4 py-3 font-medium">Bezeichnung</th>
                <th className="px-4 py-3 font-medium text-right">Dichte (kg/m³)</th>
                <th className="px-4 py-3 font-medium text-right">Preis (€/kg)</th>
                <th className="px-4 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {materialien.map((m) => (
                <tr
                  key={m.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${changed[m.id] ? 'bg-amber-50' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{m.werkstoff}</td>
                  <td className="px-4 py-3 text-gray-600">{m.bezeichnung}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      value={m.dichte}
                      onChange={e => handleChange(m.id, 'dichte', e.target.value)}
                      className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={m.preis}
                      onChange={e => handleChange(m.id, 'preis', e.target.value)}
                      className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {changed[m.id] && (
                        <button
                          onClick={() => handleSave(m)}
                          disabled={saving}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Speichern"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Löschen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {materialien.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            Keine Materialien vorhanden.
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Geänderte Zeilen werden gelb markiert. Preis und Dichte direkt in der Tabelle bearbeiten, dann speichern.
      </p>

      {/* Modal: Neues Material */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Neues Material</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Werkstoffgruppe *</label>
                  <input
                    type="text"
                    value={form.werkstoff}
                    onChange={e => setForm(f => ({ ...f, werkstoff: e.target.value }))}
                    placeholder="z.B. Aluminium"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung *</label>
                  <input
                    type="text"
                    value={form.bezeichnung}
                    onChange={e => setForm(f => ({ ...f, bezeichnung: e.target.value }))}
                    placeholder="z.B. AlMg3 (3.3535)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dichte (kg/m³)</label>
                    <input
                      type="number"
                      value={form.dichte}
                      onChange={e => setForm(f => ({ ...f, dichte: e.target.value }))}
                      placeholder="7850"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preis (€/kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.preis}
                      onChange={e => setForm(f => ({ ...f, preis: e.target.value }))}
                      placeholder="8.00"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.werkstoff.trim() || !form.bezeichnung.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Speichert…' : 'Hinzufügen'}
                </button>
                <button
                  onClick={() => { setShowAdd(false); setForm(emptyForm); }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reset Bestätigung */}
      {resetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Auf Standard zurücksetzen?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Alle eigenen Änderungen und selbst hinzugefügten Materialien werden gelöscht und durch die Standard-Werkstoffliste ersetzt.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {saving ? 'Wird zurückgesetzt…' : 'Ja, zurücksetzen'}
              </button>
              <button
                onClick={() => setResetConfirm(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Materialpreise;
