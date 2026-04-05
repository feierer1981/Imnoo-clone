import { useState } from 'react';
import { Link } from 'react-router-dom';

const stats = [
  { label: 'Kalkulationen', value: 24, color: 'bg-indigo-500', icon: '9' },
  { label: 'Angebote', value: 12, color: 'bg-emerald-500', icon: 'A' },
  { label: 'Materialien', value: 8, color: 'bg-amber-500', icon: 'M' },
  { label: 'Uploads', value: 3, color: 'bg-rose-500', icon: 'U' },
];

const recentCalcs = [
  { id: 1, name: 'Gehaeuse A', material: 'Aluminium 6061', stueckzahl: 10, preis: '245,50 EUR', datum: '28.03.2026' },
  { id: 2, name: 'Welle B', material: 'Stahl S235', stueckzahl: 25, preis: '189,00 EUR', datum: '27.03.2026' },
  { id: 3, name: 'Flansch C', material: 'Edelstahl 1.4301', stueckzahl: 5, preis: '312,75 EUR', datum: '26.03.2026' },
  { id: 4, name: 'Adapter D', material: 'Messing CuZn39Pb3', stueckzahl: 50, preis: '78,20 EUR', datum: '25.03.2026' },
];

// ─── Roboter-Maskottchen ──────────────────────────────────────────────────────
function Robot() {
  const [active, setActive] = useState(false);

  const handleClick = () => {
    if (active) return;
    setActive(true);
    setTimeout(() => setActive(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <style>{`
        @keyframes rbt-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-7px); }
        }
        @keyframes rbt-dance {
          0%   { transform: translateY(0)    rotate(0deg)  scale(1);    }
          10%  { transform: translateY(-14px) rotate(-10deg) scale(1.07); }
          22%  { transform: translateY(-3px)  rotate(10deg)  scale(1.07); }
          34%  { transform: translateY(-12px) rotate(-7deg)  scale(1.03); }
          46%  { transform: translateY(-2px)  rotate(7deg)   scale(1.03); }
          58%  { transform: translateY(-9px)  rotate(-4deg)  scale(1.05); }
          70%  { transform: translateY(-1px)  rotate(4deg)   scale(1.05); }
          84%  { transform: translateY(-5px)  rotate(-2deg)  scale(1.02); }
          100% { transform: translateY(0)    rotate(0deg)  scale(1);    }
        }
        @keyframes rbt-blink {
          0%, 88%, 100% { transform: scaleY(1); }
          92%           { transform: scaleY(0.07); }
          96%           { transform: scaleY(1); }
        }
        @keyframes rbt-arm-l {
          0%, 100% { transform: rotate(0deg); }
          30%      { transform: rotate(-55deg); }
          70%      { transform: rotate(12deg); }
        }
        @keyframes rbt-arm-r {
          0%, 100% { transform: rotate(0deg); }
          30%      { transform: rotate(55deg); }
          70%      { transform: rotate(-12deg); }
        }
        @keyframes rbt-antenna {
          0%, 100% { opacity: 1; r: 4; }
          50%      { opacity: 0.25; }
        }
        @keyframes rbt-happy-eyes {
          0%, 100% { transform: scaleY(1); }
          50%      { transform: scaleY(0.6); }
        }
        .rbt-idle   { animation: rbt-float 2.8s ease-in-out infinite; }
        .rbt-dance  { animation: rbt-dance 0.45s ease-in-out 4 forwards; }
        .rbt-eye    { animation: rbt-blink 4.5s ease-in-out infinite;
                      transform-origin: center; transform-box: fill-box; }
        .rbt-eye-d  { animation: rbt-happy-eyes 0.45s ease-in-out infinite;
                      transform-origin: center; transform-box: fill-box; }
        .rbt-arm-l  { animation: rbt-arm-l 0.45s ease-in-out infinite;
                      transform-origin: 50% 0%; transform-box: fill-box; }
        .rbt-arm-r  { animation: rbt-arm-r 0.45s ease-in-out infinite;
                      transform-origin: 50% 0%; transform-box: fill-box; }
        .rbt-dot    { animation: rbt-antenna 1.1s ease-in-out infinite; }
      `}</style>

      <div
        className={`cursor-pointer select-none ${active ? 'rbt-dance' : 'rbt-idle'}`}
        onClick={handleClick}
        title="Klick mich!"
      >
        <svg width="88" height="128" viewBox="0 0 88 128" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Antenne */}
          <line x1="44" y1="4" x2="44" y2="19" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="44" cy="4" r="4" fill="#f59e0b" className="rbt-dot"/>

          {/* Kopf */}
          <rect x="19" y="19" width="50" height="37" rx="10" fill="#6366f1"/>
          <rect x="23" y="21" width="42" height="9" rx="5" fill="#818cf8" opacity="0.35"/>

          {/* Augen (weiß) */}
          <circle cx="32" cy="37" r="7.5" fill="white"/>
          <circle cx="56" cy="37" r="7.5" fill="white"/>
          {/* Pupillen */}
          <circle cx="32" cy="37" r="3.8" fill="#1e1b4b" className={active ? 'rbt-eye-d' : 'rbt-eye'}/>
          <circle cx="56" cy="37" r="3.8" fill="#1e1b4b" className={active ? 'rbt-eye-d' : 'rbt-eye'}/>
          {/* Glanzpunkte */}
          <circle cx="33.8" cy="35.2" r="1.3" fill="white"/>
          <circle cx="57.8" cy="35.2" r="1.3" fill="white"/>

          {/* Mund */}
          {active
            ? <path d="M 29 49 Q 44 59 59 49" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            : <path d="M 30 49 Q 44 55 58 49" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          }

          {/* Hals */}
          <rect x="37" y="56" width="14" height="8" rx="3" fill="#4f46e5"/>

          {/* Körper */}
          <rect x="14" y="64" width="60" height="44" rx="10" fill="#4f46e5"/>
          <rect x="19" y="66" width="50" height="8" rx="4" fill="#6366f1" opacity="0.45"/>

          {/* Brust-Panel */}
          <rect x="24" y="75" width="40" height="25" rx="6" fill="#6366f1"/>
          {/* Knöpfe */}
          <circle cx="33" cy="83" r="4" fill="#f59e0b"/>
          <circle cx="44" cy="83" r="4" fill="#10b981"/>
          <circle cx="55" cy="83" r="4" fill="#ef4444"/>
          {/* Lautsprecher */}
          <line x1="30" y1="91" x2="58" y2="91" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/>
          <line x1="33" y1="95" x2="55" y2="95" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/>

          {/* Linker Arm */}
          <g className={active ? 'rbt-arm-l' : ''}>
            <rect x="2" y="66" width="13" height="31" rx="6.5" fill="#6366f1"/>
            <circle cx="8.5" cy="99" r="5.5" fill="#4f46e5"/>
          </g>

          {/* Rechter Arm */}
          <g className={active ? 'rbt-arm-r' : ''}>
            <rect x="73" y="66" width="13" height="31" rx="6.5" fill="#6366f1"/>
            <circle cx="79.5" cy="99" r="5.5" fill="#4f46e5"/>
          </g>

          {/* Linkes Bein */}
          <rect x="21" y="106" width="18" height="19" rx="7" fill="#4f46e5"/>
          <rect x="17" y="118" width="22" height="9" rx="5" fill="#3730a3"/>

          {/* Rechtes Bein */}
          <rect x="49" y="106" width="18" height="19" rx="7" fill="#4f46e5"/>
          <rect x="49" y="118" width="22" height="9" rx="5" fill="#3730a3"/>
        </svg>
      </div>

      <p className="text-xs text-gray-400 transition-all">
        {active ? '🎉 Yay!' : 'Klick mich!'}
      </p>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard() {
  return (
    <div>
      {/* Header mit Roboter */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 mt-1">Uebersicht Ihrer CNC-Kalkulationen und Angebote</p>
        </div>
        <Robot />
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
