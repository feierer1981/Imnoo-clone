import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';

// ─── Hilfkomponenten ──────────────────────────────────────────────────────────

function InputField({ label, name, value, onChange, placeholder = '', type = 'text', hint = '' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function RadioGroup({ label, options, value, onChange, hint = '' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm select-none ${
              value === opt.value
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.icon && <span>{opt.icon}</span>}
            {opt.label}
          </label>
        ))}
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Standard-Workflow ────────────────────────────────────────────────────────
const defaultWorkflow = {
  name: '',
  maschinentyp: 'fraesen',
  fraeswerkzeug: '',
  bohrwerkzeugFraesen: '',
  drehwerkzeug: '',
  bohrwerkzeugDrehen: '',
  fertigungstyp: '',
  maschinenstundensatz: '',
  maxBauteilLaenge: '',
  maxBauteilBreite: '',
  maxBauteilHoehe: '',
  ncProgramm: '',
};

// ─── WorkflowForm ─────────────────────────────────────────────────────────────
function WorkflowForm({ initial, onSave, onCancel }) {
  const [wf, setWf] = useState(() => ({ ...defaultWorkflow, ...initial }));
  const [saving, setSaving] = useState(false);

  const update = (field, val) => setWf((prev) => ({ ...prev, [field]: val }));

  const handleSave = async () => {
    if (!wf.name.trim()) return;
    setSaving(true);
    await onSave(wf);
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-indigo-100 p-6 space-y-6">
      <h3 className="font-semibold text-gray-800">
        {wf.id ? 'Workflow bearbeiten' : 'Neuer Workflow'}
      </h3>

      {/* Name */}
      <InputField
        label="Workflow-Name *"
        name="name"
        value={wf.name}
        onChange={(e) => update('name', e.target.value)}
        placeholder="z.B. Drehen Stahl, Fräsen Aluminium 5-Achser"
      />

      {/* Maschinentyp */}
      <RadioGroup
        label="Meine Maschine"
        value={wf.maschinentyp}
        onChange={(v) => update('maschinentyp', v)}
        options={[
          { value: 'fraesen', label: 'Fräsen', icon: '⚙️' },
          { value: 'drehen', label: 'Drehen', icon: '🔄' },
        ]}
      />

      {/* Werkzeuge – Fräsen */}
      {wf.maschinentyp === 'fraesen' && (
        <div className="space-y-4 pl-4 border-l-4 border-indigo-100 ml-1">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Werkzeuge beim Fräsen</p>
          <RadioGroup
            label="Fräswerkzeuge – überwiegend"
            value={wf.fraeswerkzeug}
            onChange={(v) => update('fraeswerkzeug', v)}
            options={[
              { value: 'hss', label: 'HSS' },
              { value: 'vhm', label: 'VHM (Hartmetall)' },
            ]}
          />
          <RadioGroup
            label="Bohrwerkzeuge beim Fräsen – überwiegend"
            value={wf.bohrwerkzeugFraesen}
            onChange={(v) => update('bohrwerkzeugFraesen', v)}
            options={[
              { value: 'hss', label: 'HSS' },
              { value: 'vhm', label: 'VHM (Hartmetall)' },
            ]}
          />
        </div>
      )}

      {/* Werkzeuge – Drehen */}
      {wf.maschinentyp === 'drehen' && (
        <div className="space-y-4 pl-4 border-l-4 border-indigo-100 ml-1">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Werkzeuge beim Drehen</p>
          <RadioGroup
            label="Drehwerkzeuge – überwiegend"
            value={wf.drehwerkzeug}
            onChange={(v) => update('drehwerkzeug', v)}
            options={[
              { value: 'hss', label: 'HSS' },
              { value: 'vhm', label: 'VHM (Hartmetall)' },
            ]}
          />
          <RadioGroup
            label="Bohrwerkzeuge auf der Drehmaschine – überwiegend"
            value={wf.bohrwerkzeugDrehen}
            onChange={(v) => update('bohrwerkzeugDrehen', v)}
            options={[
              { value: 'hss', label: 'HSS' },
              { value: 'vhm', label: 'VHM (Hartmetall)' },
            ]}
          />
        </div>
      )}

      {/* Fertigungsart */}
      <RadioGroup
        label="Fertigungsart"
        value={wf.fertigungstyp}
        onChange={(v) => update('fertigungstyp', v)}
        options={[
          { value: 'einzel', label: 'Einzelfertigung' },
          { value: 'einzel_wiederkehrend', label: 'Einzelfertigung mit wiederkehrenden Teilen (Teilautomatisiert)' },
          { value: 'masse', label: 'Massenfertigung' },
        ]}
      />

      {/* Maschinenstundensatz */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Maschinenstundensatz</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={wf.maschinenstundensatz}
            onChange={(e) => update('maschinenstundensatz', e.target.value)}
            placeholder="z.B. 90"
            min="0"
            step="0.5"
            className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
          />
          <span className="text-sm text-gray-500">€/h</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">Wird für die Preisberechnung in der Kalkulation verwendet</p>
      </div>

      {/* Max Bauteilgröße */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Maximale Bauteilgröße</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'maxBauteilLaenge', label: 'Länge' },
            { key: 'maxBauteilBreite', label: 'Breite' },
            { key: 'maxBauteilHoehe', label: 'Höhe' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label} (mm)</label>
              <input
                type="number"
                value={wf[key]}
                onChange={(e) => update(key, e.target.value)}
                placeholder="0"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* NC-Programm / CAM */}
      <RadioGroup
        label="NC-Programm / CAM"
        value={wf.ncProgramm}
        onChange={(v) => update('ncProgramm', v)}
        options={[
          { value: 'manuell', label: 'Manuell programmiert' },
          { value: 'cam', label: 'CAM-Software' },
          { value: 'archiv', label: 'Wiederholt aus Archiv' },
        ]}
        hint="Beeinflusst die Programmierzeit in der KI-Kalkulation"
      />

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={!wf.name.trim() || saving}
          className="flex items-center gap-2 px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg transition-colors"
        >
          {saving ? (
            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Wird gespeichert...</>
          ) : (
            wf.id ? 'Speichern' : 'Workflow anlegen'
          )}
        </button>
      </div>
    </div>
  );
}

// ─── WorkflowsTab ─────────────────────────────────────────────────────────────
function WorkflowsTab({ workflows, loading, editingWorkflow, setEditingWorkflow, deletingId, setDeletingId, onSave, onDelete }) {
  const maschinenLabel = { fraesen: 'Fräsen ⚙️', drehen: 'Drehen 🔄' };
  const fertigungLabel = {
    einzel: 'Einzelfertigung',
    einzel_wiederkehrend: 'Einzel (wiederkehrend)',
    masse: 'Massenfertigung',
  };
  const ncLabel = { manuell: 'Manuell', cam: 'CAM', archiv: 'Aus Archiv' };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Workflows definieren Ihre Maschinenausstattung und werden in der Kalkulation ausgewählt.
        </p>
        {!editingWorkflow && (
          <button
            onClick={() => setEditingWorkflow({})}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neuer Workflow
          </button>
        )}
      </div>

      {/* Neuer/Edit Workflow Form */}
      {editingWorkflow && (
        <WorkflowForm
          initial={editingWorkflow}
          onSave={onSave}
          onCancel={() => setEditingWorkflow(null)}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      )}

      {/* Leer-Zustand */}
      {!loading && workflows.length === 0 && !editingWorkflow && (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
          <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 font-medium mb-1">Noch keine Workflows angelegt</p>
          <p className="text-gray-400 text-sm">Legen Sie einen Workflow an, um ihn in der Kalkulation auswählen zu können.</p>
        </div>
      )}

      {/* Workflow-Liste */}
      {!loading && workflows.map((wf) => (
        <div key={wf.id} className="bg-white rounded-xl border border-gray-200 p-5">
          {deletingId === wf.id ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Workflow <strong>{wf.name}</strong> wirklich löschen?
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeletingId(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Abbrechen</button>
                <button onClick={() => onDelete(wf.id)} className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg">Löschen</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-gray-800">{wf.name}</h3>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                    {maschinenLabel[wf.maschinentyp] || wf.maschinentyp}
                  </span>
                  {wf.fertigungstyp && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {fertigungLabel[wf.fertigungstyp]}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                  {wf.maschinenstundensatz && (
                    <span>Stundensatz: <strong className="text-gray-700">{wf.maschinenstundensatz} €/h</strong></span>
                  )}
                  {(wf.maxBauteilLaenge || wf.maxBauteilBreite || wf.maxBauteilHoehe) && (
                    <span>Max. Bauteil: <strong className="text-gray-700">{wf.maxBauteilLaenge}×{wf.maxBauteilBreite}×{wf.maxBauteilHoehe} mm</strong></span>
                  )}
                  {wf.ncProgramm && (
                    <span>NC-Programm: <strong className="text-gray-700">{ncLabel[wf.ncProgramm]}</strong></span>
                  )}
                  {wf.maschinentyp === 'fraesen' && wf.fraeswerkzeug && (
                    <span>Fräser: <strong className="text-gray-700">{wf.fraeswerkzeug.toUpperCase()}</strong></span>
                  )}
                  {wf.maschinentyp === 'drehen' && wf.drehwerkzeug && (
                    <span>Drehwerkzeug: <strong className="text-gray-700">{wf.drehwerkzeug.toUpperCase()}</strong></span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setEditingWorkflow(wf)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Bearbeiten"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeletingId(wf.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Löschen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── KontaktForm ──────────────────────────────────────────────────────────────
function KontaktForm({ kontakt, setKontakt, loading, saving, saved, logoFile, setLogoFile, logoPreview, setLogoPreview, logoInputRef, onSave }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setKontakt((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Bitte eine Bilddatei auswählen.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Logo ist größer als 5 MB.'); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Firmenlogo</h2>
        <div className="flex items-center gap-5">
          <div
            onClick={() => logoInputRef.current?.click()}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors overflow-hidden"
          >
            {logoPreview || kontakt.logoUrl ? (
              <img src={logoPreview || kontakt.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          <div>
            <button
              onClick={() => logoInputRef.current?.click()}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {kontakt.logoUrl || logoPreview ? 'Logo ändern' : 'Logo hochladen'}
            </button>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG – max. 5 MB</p>
            {logoFile && <p className="text-xs text-green-600 mt-1">{logoFile.name} ausgewählt</p>}
          </div>
        </div>
      </div>

      {/* Firmendaten */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Firmendaten</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <InputField label="Firmenname" name="firmenname" value={kontakt.firmenname || ''} onChange={handleChange} placeholder="Musterfirma GmbH" />
          </div>
          <InputField label="Straße + Hausnummer" name="strasse" value={kontakt.strasse || ''} onChange={handleChange} placeholder="Musterstraße 1" />
          <div className="grid grid-cols-3 gap-3">
            <InputField label="PLZ" name="plz" value={kontakt.plz || ''} onChange={handleChange} placeholder="12345" />
            <div className="col-span-2">
              <InputField label="Ort" name="ort" value={kontakt.ort || ''} onChange={handleChange} placeholder="Musterstadt" />
            </div>
          </div>
        </div>
      </div>

      {/* Kontakt */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Kontakt</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label="E-Mail" name="email" value={kontakt.email || ''} onChange={handleChange} type="email" placeholder="info@musterfirma.de" />
          <InputField label="Telefon" name="telefon" value={kontakt.telefon || ''} onChange={handleChange} placeholder="+49 123 456789" />
        </div>
      </div>

      {/* Steuer & Bank */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Steuer & Bank</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Umsatzsteuernummer"
            name="ustNummer"
            value={kontakt.ustNummer || ''}
            onChange={handleChange}
            placeholder="DE123456789"
            hint="USt-IdNr. für Rechnungen"
          />
          <InputField
            label="IBAN"
            name="iban"
            value={kontakt.iban || ''}
            onChange={handleChange}
            placeholder="DE89 3704 0044 0532 0130 00"
            hint="Für Rechnungen und Angebote"
          />
        </div>
      </div>

      {/* Speichern */}
      <div className="flex items-center gap-4">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg transition-colors text-sm"
        >
          {saving ? (
            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Wird gespeichert...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg> Kontaktdaten speichern</>
          )}
        </button>
        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Gespeichert!
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
function Einstellungen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('kontakt');

  // Kontaktdaten
  const [kontakt, setKontakt] = useState({
    firmenname: '', strasse: '', plz: '', ort: '',
    email: '', telefon: '', ustNummer: '', iban: '', logoUrl: '',
  });
  const [kontaktLoading, setKontaktLoading] = useState(true);
  const [kontaktSaving, setKontaktSaving] = useState(false);
  const [kontaktSaved, setKontaktSaved] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const logoInputRef = useRef(null);

  // Workflows
  const [workflows, setWorkflows] = useState([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Kontaktdaten laden
  useEffect(() => {
    async function load() {
      try {
        const d = await getDoc(doc(db, 'users', user.uid, 'profil', 'data'));
        if (d.exists()) setKontakt((prev) => ({ ...prev, ...d.data() }));
      } catch (err) {
        console.error(err);
      } finally {
        setKontaktLoading(false);
      }
    }
    load();
  }, [user.uid]);

  // Workflows laden wenn Tab aktiv
  useEffect(() => {
    if (activeTab === 'workflows') loadWorkflows();
  }, [activeTab]);

  async function loadWorkflows() {
    setWorkflowsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'workflows'));
      setWorkflows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setWorkflowsLoading(false);
    }
  }

  const handleKontaktSpeichern = async () => {
    setKontaktSaving(true);
    try {
      let logoUrl = kontakt.logoUrl || '';
      if (logoFile) {
        const logoRef = ref(storage, `profile/${user.uid}/logo`);
        await uploadBytes(logoRef, logoFile);
        logoUrl = await getDownloadURL(logoRef);
        setLogoFile(null);
        setLogoPreview(null);
      }
      await setDoc(doc(db, 'users', user.uid, 'profil', 'data'), {
        ...kontakt,
        logoUrl,
        aktualisiertAm: serverTimestamp(),
      });
      setKontakt((prev) => ({ ...prev, logoUrl }));
      setKontaktSaved(true);
      setTimeout(() => setKontaktSaved(false), 3000);
    } catch (err) {
      alert('Fehler beim Speichern: ' + err.message);
    } finally {
      setKontaktSaving(false);
    }
  };

  const handleWorkflowSpeichern = async (wf) => {
    try {
      if (wf.id) {
        const { id, erstelltAm, ...data } = wf;
        await updateDoc(doc(db, 'users', user.uid, 'workflows', id), {
          ...data,
          aktualisiertAm: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'users', user.uid, 'workflows'), {
          ...wf,
          erstelltAm: serverTimestamp(),
        });
      }
      setEditingWorkflow(null);
      await loadWorkflows();
    } catch (err) {
      alert('Fehler: ' + err.message);
    }
  };

  const handleWorkflowDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'workflows', id));
      setDeletingId(null);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      alert('Fehler beim Löschen: ' + err.message);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Einstellungen</h1>
        <p className="text-gray-500 mt-1">Kontaktdaten und Kalkulations-Workflows verwalten</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'kontakt', label: 'Kontaktdaten', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
          { key: 'workflows', label: 'Workflows', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'kontakt' && (
        <KontaktForm
          kontakt={kontakt}
          setKontakt={setKontakt}
          loading={kontaktLoading}
          saving={kontaktSaving}
          saved={kontaktSaved}
          logoFile={logoFile}
          setLogoFile={setLogoFile}
          logoPreview={logoPreview}
          setLogoPreview={setLogoPreview}
          logoInputRef={logoInputRef}
          onSave={handleKontaktSpeichern}
        />
      )}

      {activeTab === 'workflows' && (
        <WorkflowsTab
          workflows={workflows}
          loading={workflowsLoading}
          editingWorkflow={editingWorkflow}
          setEditingWorkflow={setEditingWorkflow}
          deletingId={deletingId}
          setDeletingId={setDeletingId}
          onSave={handleWorkflowSpeichern}
          onDelete={handleWorkflowDelete}
        />
      )}
    </div>
  );
}

export default Einstellungen;
