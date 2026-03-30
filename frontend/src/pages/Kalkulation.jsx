import { useState, useMemo } from 'react';

// Verfuegbare Materialien fuer die Auswahl
const materialien = [
  'Aluminium 6061',
  'Stahl S235',
  'Edelstahl 1.4301',
  'Messing CuZn39Pb3',
  'Titan Grade 5',
];

// Toleranz-Optionen
const toleranzen = ['±0.1mm', '±0.05mm', '±0.01mm'];

// Oberflaechenguete-Optionen
const oberflaechen = ['Ra 3.2', 'Ra 1.6', 'Ra 0.8'];

function Kalkulation() {
  const [form, setForm] = useState({
    name: '',
    beschreibung: '',
    material: materialien[0],
    laenge: '',
    breite: '',
    hoehe: '',
    stueckzahl: 1,
    toleranz: toleranzen[0],
    oberflaeche: oberflaechen[0],
  });

  // Formularfeld aktualisieren
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Automatische Kalkulation bei Formularaenderung
  const kalkulation = useMemo(() => {
    const l = parseFloat(form.laenge) || 0;
    const b = parseFloat(form.breite) || 0;
    const h = parseFloat(form.hoehe) || 0;
    const stueck = parseInt(form.stueckzahl) || 1;

    // Bearbeitungsvolumen in cm³ (mm -> cm: /10)
    const volumenCm3 = (l * b * h) / 1000;

    // Maschinenlaufzeit: Volumen / 50 (min)
    const maschinenlaufzeit = volumenCm3 / 50;

    // Feste Zeiten
    const ruestzeit = 10;
    const programmierzeit = 5;

    // Gesamtzeit pro Stueck
    const gesamtzeit = maschinenlaufzeit + ruestzeit + programmierzeit;

    // Stueckpreis: Gesamtzeit * 1.50 EUR/min
    const stueckpreis = gesamtzeit * 1.5;

    // Gesamtpreis
    const gesamtpreis = stueckpreis * stueck;

    return {
      volumenCm3,
      maschinenlaufzeit,
      ruestzeit,
      programmierzeit,
      gesamtzeit,
      stueckpreis,
      gesamtpreis,
    };
  }, [form]);

  // Formatierung als EUR-Betrag
  const formatEur = (val) =>
    val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  const formatMin = (val) => val.toFixed(2) + ' min';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Kalkulation</h1>
        <p className="text-gray-500 mt-1">
          CNC-Fertigungskosten berechnen
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linke Seite: Formular (2/3 Breite) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bauteil-Informationen */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Bauteil-Informationen
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="z.B. Gehaeuse Typ A"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung
                </label>
                <input
                  type="text"
                  name="beschreibung"
                  value={form.beschreibung}
                  onChange={handleChange}
                  placeholder="Kurze Beschreibung des Bauteils"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Material-Auswahl */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Material-Auswahl
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Material
              </label>
              <select
                name="material"
                value={form.material}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {materialien.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Abmessungen */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Abmessungen
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Laenge (mm)
                </label>
                <input
                  type="number"
                  name="laenge"
                  value={form.laenge}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Breite (mm)
                </label>
                <input
                  type="number"
                  name="breite"
                  value={form.breite}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hoehe (mm)
                </label>
                <input
                  type="number"
                  name="hoehe"
                  value={form.hoehe}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Fertigungsdetails */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Fertigungsdetails
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stueckzahl
                </label>
                <input
                  type="number"
                  name="stueckzahl"
                  value={form.stueckzahl}
                  onChange={handleChange}
                  min="1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Toleranz
                </label>
                <select
                  name="toleranz"
                  value={form.toleranz}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {toleranzen.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Oberflaechenguete
                </label>
                <select
                  name="oberflaeche"
                  value={form.oberflaeche}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {oberflaechen.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Rechte Seite: Ergebnis-Karte (1/3 Breite) */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-24">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Kalkulations-Ergebnis
            </h2>

            <div className="space-y-3 text-sm">
              {/* Zeitaufstellung */}
              <div className="pb-3 border-b border-gray-100">
                <h3 className="font-medium text-gray-600 mb-2">Zeitaufstellung</h3>
                <div className="flex justify-between text-gray-600">
                  <span>Bearbeitungsvolumen</span>
                  <span className="font-medium text-gray-800">
                    {kalkulation.volumenCm3.toFixed(2)} cm&sup3;
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 mt-1">
                  <span>Maschinenlaufzeit</span>
                  <span className="font-medium text-gray-800">
                    {formatMin(kalkulation.maschinenlaufzeit)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 mt-1">
                  <span>Ruestzeit</span>
                  <span className="font-medium text-gray-800">
                    {formatMin(kalkulation.ruestzeit)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 mt-1">
                  <span>Programmierzeit</span>
                  <span className="font-medium text-gray-800">
                    {formatMin(kalkulation.programmierzeit)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-800 font-semibold mt-2 pt-2 border-t border-gray-100">
                  <span>Gesamtzeit</span>
                  <span>{formatMin(kalkulation.gesamtzeit)}</span>
                </div>
              </div>

              {/* Kostenaufstellung */}
              <div className="pb-3 border-b border-gray-100">
                <h3 className="font-medium text-gray-600 mb-2">Kostenaufstellung</h3>
                <div className="flex justify-between text-gray-600">
                  <span>Stundensatz</span>
                  <span className="font-medium text-gray-800">1,50 EUR/min</span>
                </div>
                <div className="flex justify-between text-gray-600 mt-1">
                  <span>Stueckpreis</span>
                  <span className="font-medium text-gray-800">
                    {formatEur(kalkulation.stueckpreis)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 mt-1">
                  <span>Stueckzahl</span>
                  <span className="font-medium text-gray-800">
                    {parseInt(form.stueckzahl) || 1}
                  </span>
                </div>
              </div>

              {/* Gesamtpreis */}
              <div className="bg-indigo-50 rounded-lg p-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-indigo-800 font-semibold">Gesamtpreis</span>
                  <span className="text-2xl font-bold text-indigo-700">
                    {formatEur(kalkulation.gesamtpreis)}
                  </span>
                </div>
              </div>

              {/* Zusammenfassung */}
              <div className="mt-2 text-xs text-gray-400">
                Material: {form.material} | Toleranz: {form.toleranz} | Oberflaeche: {form.oberflaeche}
              </div>
            </div>

            {/* Angebot erstellen Button */}
            <button
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
              onClick={() => alert('Angebot wird erstellt (Platzhalter)')}
            >
              Angebot erstellen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Kalkulation;
