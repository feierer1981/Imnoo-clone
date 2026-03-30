import { useState } from 'react';

// Mock-Daten fuer bereits hochgeladene Dateien
const mockDateien = [
  { id: 1, name: 'gehaeuse_v2.step', groesse: '2,4 MB', datum: '28.03.2026', format: 'STEP' },
  { id: 2, name: 'welle_final.stp', groesse: '1,1 MB', datum: '27.03.2026', format: 'STP' },
  { id: 3, name: 'flansch_proto.stl', groesse: '4,8 MB', datum: '26.03.2026', format: 'STL' },
];

function Upload() {
  const [dragOver, setDragOver] = useState(false);

  // Visuelles Feedback beim Drag-Vorgang (kein echtes Upload)
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    alert('Upload-Funktion ist noch nicht implementiert (Platzhalter)');
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Datei-Upload</h1>
        <p className="text-gray-500 mt-1">CAD-Dateien fuer die automatische Analyse hochladen</p>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-gray-50'
        }`}
        onClick={() => alert('Upload-Funktion ist noch nicht implementiert (Platzhalter)')}
      >
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p className="text-gray-700 font-medium text-lg mb-1">
          Dateien hierher ziehen oder klicken zum Auswaehlen
        </p>
        <p className="text-sm text-gray-500">
          Unterstuetzte Formate: .step, .stp, .iges, .stl
        </p>
        <p className="text-xs text-gray-400 mt-2">Maximale Dateigroesse: 50 MB</p>
      </div>

      {/* Unterstuetzte Formate Info */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { ext: '.STEP', desc: 'Standard fuer CAD-Daten' },
          { ext: '.STP', desc: 'STEP-Alternativformat' },
          { ext: '.IGES', desc: 'Aelterer CAD-Standard' },
          { ext: '.STL', desc: '3D-Druckformat / Mesh' },
        ].map((f) => (
          <div key={f.ext} className="bg-white rounded-lg border border-gray-100 p-3 text-center">
            <p className="text-sm font-bold text-indigo-600">{f.ext}</p>
            <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Hochgeladene Dateien */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Hochgeladene Dateien</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Dateiname</th>
                  <th className="px-6 py-3 font-medium">Format</th>
                  <th className="px-6 py-3 font-medium">Groesse</th>
                  <th className="px-6 py-3 font-medium">Datum</th>
                </tr>
              </thead>
              <tbody>
                {mockDateien.map((datei) => (
                  <tr key={datei.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-800 flex items-center gap-2">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      {datei.name}
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {datei.format}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{datei.groesse}</td>
                    <td className="px-6 py-3 text-gray-500">{datei.datum}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Upload;
