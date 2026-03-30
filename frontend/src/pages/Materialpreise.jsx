// Mock-Daten fuer Materialpreise
const materialien = [
  { id: 1, name: 'Aluminium 6061', preisProKg: '8,50 EUR', verfuegbarkeit: 'Auf Lager', lieferzeit: '2-3 Tage' },
  { id: 2, name: 'Stahl S235', preisProKg: '3,20 EUR', verfuegbarkeit: 'Auf Lager', lieferzeit: '1-2 Tage' },
  { id: 3, name: 'Edelstahl 1.4301', preisProKg: '12,80 EUR', verfuegbarkeit: 'Auf Lager', lieferzeit: '3-5 Tage' },
  { id: 4, name: 'Messing CuZn39Pb3', preisProKg: '15,40 EUR', verfuegbarkeit: 'Begrenzt', lieferzeit: '5-7 Tage' },
  { id: 5, name: 'Titan Grade 5', preisProKg: '85,00 EUR', verfuegbarkeit: 'Auf Anfrage', lieferzeit: '10-14 Tage' },
];

// Farbkodierung fuer Verfuegbarkeit
function verfuegbarkeitBadge(status) {
  const colors = {
    'Auf Lager': 'bg-emerald-100 text-emerald-700',
    'Begrenzt': 'bg-amber-100 text-amber-700',
    'Auf Anfrage': 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function Materialpreise() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Materialpreise</h1>
        <p className="text-gray-500 mt-1">Aktuelle Preise und Verfuegbarkeiten</p>
      </div>

      {/* Info-Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-blue-700">
          Preise werden zukuenftig ueber eine API automatisch aktualisiert. Die angezeigten Preise sind Richtwerte.
        </p>
      </div>

      {/* Materialpreise-Tabelle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Material</th>
                <th className="px-6 py-3 font-medium">Preis/kg</th>
                <th className="px-6 py-3 font-medium">Verfuegbarkeit</th>
                <th className="px-6 py-3 font-medium">Lieferzeit</th>
              </tr>
            </thead>
            <tbody>
              {materialien.map((mat) => (
                <tr key={mat.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-800">{mat.name}</td>
                  <td className="px-6 py-4 text-gray-700 font-medium">{mat.preisProKg}</td>
                  <td className="px-6 py-4">{verfuegbarkeitBadge(mat.verfuegbarkeit)}</td>
                  <td className="px-6 py-4 text-gray-600">{mat.lieferzeit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Materialpreise;
