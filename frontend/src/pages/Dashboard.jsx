import { Link } from 'react-router-dom';

// Statistik-Karten fuer das Dashboard
const stats = [
  { label: 'Kalkulationen', value: 24, color: 'bg-indigo-500', icon: '9' },
  { label: 'Angebote', value: 12, color: 'bg-emerald-500', icon: 'A' },
  { label: 'Materialien', value: 8, color: 'bg-amber-500', icon: 'M' },
  { label: 'Uploads', value: 3, color: 'bg-rose-500', icon: 'U' },
];

// Mock-Daten fuer die letzten Kalkulationen
const recentCalcs = [
  { id: 1, name: 'Gehaeuse A', material: 'Aluminium 6061', stueckzahl: 10, preis: '245,50 EUR', datum: '28.03.2026' },
  { id: 2, name: 'Welle B', material: 'Stahl S235', stueckzahl: 25, preis: '189,00 EUR', datum: '27.03.2026' },
  { id: 3, name: 'Flansch C', material: 'Edelstahl 1.4301', stueckzahl: 5, preis: '312,75 EUR', datum: '26.03.2026' },
  { id: 4, name: 'Adapter D', material: 'Messing CuZn39Pb3', stueckzahl: 50, preis: '78,20 EUR', datum: '25.03.2026' },
];

function Dashboard() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1">Uebersicht Ihrer CNC-Kalkulationen und Angebote</p>
      </div>

      {/* Statistik-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 card-hover"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-bold`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Letzte Kalkulationen */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Letzte Kalkulationen</h2>
          <Link
            to="/kalkulation"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Neue Kalkulation &rarr;
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Bauteil</th>
                <th className="px-6 py-3 font-medium">Material</th>
                <th className="px-6 py-3 font-medium">Stueckzahl</th>
                <th className="px-6 py-3 font-medium">Preis</th>
                <th className="px-6 py-3 font-medium">Datum</th>
              </tr>
            </thead>
            <tbody>
              {recentCalcs.map((calc) => (
                <tr key={calc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-gray-800">{calc.name}</td>
                  <td className="px-6 py-3 text-gray-600">{calc.material}</td>
                  <td className="px-6 py-3 text-gray-600">{calc.stueckzahl}</td>
                  <td className="px-6 py-3 font-medium text-gray-800">{calc.preis}</td>
                  <td className="px-6 py-3 text-gray-500">{calc.datum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
