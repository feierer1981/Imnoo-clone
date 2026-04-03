import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';

const emptyForm = { titel: '', inhalt: '' };

function PromptUebersicht() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'prompts'), orderBy('erstelltAm', 'desc'));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPrompts(items);
    } catch (err) {
      setError('Prompts konnten nicht geladen werden: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const handleEdit = (prompt) => {
    setEditingId(prompt.id);
    setFormData({ titel: prompt.titel, inhalt: prompt.inhalt });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.titel.trim() || !formData.inhalt.trim()) {
      setError('Titel und Inhalt sind Pflichtfelder.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'prompts', editingId), {
          titel: formData.titel.trim(),
          inhalt: formData.inhalt.trim(),
          geaendertAm: serverTimestamp(),
        });
        setPrompts((prev) =>
          prev.map((p) =>
            p.id === editingId
              ? { ...p, titel: formData.titel.trim(), inhalt: formData.inhalt.trim() }
              : p
          )
        );
      } else {
        const ref = await addDoc(collection(db, 'prompts'), {
          titel: formData.titel.trim(),
          inhalt: formData.inhalt.trim(),
          erstelltAm: serverTimestamp(),
        });
        setPrompts((prev) => [
          { id: ref.id, titel: formData.titel.trim(), inhalt: formData.inhalt.trim(), erstelltAm: null },
          ...prev,
        ]);
      }
      handleCancel();
    } catch (err) {
      setError('Speichern fehlgeschlagen: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    setError(null);
    try {
      await deleteDoc(doc(db, 'prompts', id));
      setPrompts((prev) => prev.filter((p) => p.id !== id));
      setConfirmDelete(null);
    } catch (err) {
      setError('Löschen fehlgeschlagen: ' + err.message);
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Einstellungen</span>
            <span className="text-gray-300">/</span>
            <span className="text-xs text-indigo-600 font-medium uppercase tracking-wider">Prompt Übersicht</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Prompt Übersicht</h1>
          <p className="text-gray-500 mt-1">Texte erstellen, bearbeiten und verwalten</p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Prompt
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          <span className="font-medium">Fehler:</span> {error}
        </div>
      )}

      {/* Formular */}
      {showForm && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-indigo-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {editingId ? 'Prompt bearbeiten' : 'Neuer Prompt'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
              <input
                type="text"
                value={formData.titel}
                onChange={(e) => setFormData((f) => ({ ...f, titel: e.target.value }))}
                placeholder="Titel eingeben..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inhalt</label>
              <textarea
                value={formData.inhalt}
                onChange={(e) => setFormData((f) => ({ ...f, inhalt: e.target.value }))}
                placeholder="Textinhalt eingeben..."
                rows={6}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
            <button
              onClick={handleCancel}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Prompts werden geladen...</p>
        </div>
      ) : prompts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 text-lg font-medium">Noch keine Prompts vorhanden</p>
          <p className="text-gray-400 text-sm mt-1">Erstelle deinen ersten Prompt über den Button oben rechts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {prompts.map((p) => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800">{p.titel}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Erstellt: {formatDate(p.erstelltAm)}</p>
                  <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap leading-relaxed">{p.inhalt}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(p)}
                    className="text-xs py-1.5 px-3 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium transition-colors"
                  >
                    Bearbeiten
                  </button>
                  {confirmDelete === p.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="text-xs py-1.5 px-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
                      >
                        {deleting === p.id ? '...' : 'Bestätigen'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs py-1.5 px-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(p.id)}
                      className="text-xs py-1.5 px-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium transition-colors"
                    >
                      Löschen
                    </button>
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

export default PromptUebersicht;
