import { Link } from 'react-router-dom';

// Mock-Daten fuer Angebote
const angebote = [
  { id: 'ANG-2026-001', kunde: 'Meier GmbH', bauteil: 'Gehaeuse A', preis: '2.455,00 EUR', status: 'Angenommen', datum: '25.03.2026' },
  { id: 'ANG-2026-002', kunde: 'Schmidt AG', bauteil: 'Welle B', preis: '1.890,00 EUR', status: 'Gesendet', datum: '26.03.2026' },
  { id: 'ANG-2026-003', kunde: 'Weber KG', bauteil: 'Flansch C', preis: '3.127,50 EUR', status: 'Entwurf', datum: '27.03.2026' },
  { id: 'ANG-2026-004', kunde: 'Fischer OHG', bauteil: 'Adapter D', preis: '780,00 EUR', status: 'Abgelehnt', datum: '20.03.2026' },
];

// Status-Badge mit passender Farbe
function statusBadge(status) {
  const colors = {
    Entwurf: 'bg-gray-100 text-gray-700',
    Gesendet: 'bg-blue-100 text-blue-700',
    Angenommen: 'bg-emerald-100 text-emerald-700',
    Abgelehnt: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function Angebote() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Angebote</h1>
          <p className="text-gray-500 mt-1">Uebersicht aller erstellten Angebote</p>
        </div>
        <Link
          to="/kalkulation"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Angebot
        </Link>
      </div>

      {/* Angebote-Tabelle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Angebots-Nr.</th>
                <th className="px-6 py-3 font-medium">Kunde</th>
                <th className="px-6 py-3 font-medium">Bauteil</th>
                <th className="px-6 py-3 font-medium">Preis</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Datum</th>
              </tr>
            </thead>
            <tbody>
              {angebote.map((ang) => (
                <tr key={ang.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-indigo-600">{ang.id}</td>
                  <td className="px-6 py-4 text-gray-800">{ang.kunde}</td>
                  <td className="px-6 py-4 text-gray-600">{ang.bauteil}</td>
                  <td className="px-6 py-4 font-medium text-gray-800">{ang.preis}</td>
                  <td className="px-6 py-4">{statusBadge(ang.status)}</td>
                  <td className="px-6 py-4 text-gray-500">{ang.datum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Angebote;
