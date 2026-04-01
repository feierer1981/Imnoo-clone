import { useState, useRef } from 'react';

function OcctTest() {
  const [log, setLog] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const addLog = (msg) => {
    setLog((prev) => prev + msg + '\n');
    console.log(msg);
  };

  const runTest = async (file) => {
    setLog('');
    setLoading(true);

    try {
      addLog('=== OpenCascade.js STEP-Lese-Test ===');
      addLog('Datei: ' + file.name + ' (' + file.size + ' bytes)');
      addLog('');
      addLog('OpenCascade WASM laden...');

      const { initOpenCascade } = await import('opencascade.js');
      const oc = await initOpenCascade();
      addLog('OpenCascade geladen. FS: ' + !!oc.FS);

      // Verfuegbare STEP-Klassen anzeigen
      const stepClasses = [];
      for (const key of Object.getOwnPropertyNames(oc)) {
        if (key.includes('STEP') || key.includes('STEPCAFControl') ||
            key.includes('IFSelect_Ret')) {
          stepClasses.push(key);
        }
      }
      addLog('STEP-Klassen: ' + stepClasses.join(', '));

      // Enum-Werte
      addLog('');
      addLog('IFSelect_ReturnStatus Enum:');
      try {
        const rs = oc.IFSelect_ReturnStatus;
        for (const key of Object.keys(rs)) {
          const val = rs[key];
          addLog('  ' + key + ' = ' + (val?.value !== undefined ? val.value : JSON.stringify(val)));
        }
      } catch (e) {
        addLog('  Enum-Fehler: ' + e.message);
      }

      // FS Root anzeigen
      try {
        addLog('');
        addLog('FS root: ' + oc.FS.readdir('/').join(', '));
      } catch (e) {
        addLog('FS Fehler: ' + e.message);
      }

      // Datei einlesen
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const text = await file.text();

      addLog('');
      addLog('Erste 200 Zeichen der Datei:');
      addLog(text.substring(0, 200));

      // --- Methode 1: Binary + relativer Pfad ---
      addLog('');
      addLog('--- Methode 1: Binary (Uint8Array) + relativer Pfad "test.step" ---');
      try {
        try { oc.FS.unlink('test.step'); } catch {}
        oc.FS.writeFile('test.step', uint8);
        const stat = oc.FS.stat('test.step');
        addLog('  Geschrieben: ' + stat.size + ' bytes');

        const reader = new oc.STEPControl_Reader_1();
        const status = reader.ReadFile('test.step');
        addLog('  Status.value: ' + status.value);

        if (status.value === 1) {
          addLog('  ERFOLG! TransferRoots...');
          reader.TransferRoots(new oc.Message_ProgressRange_1());
          const shape = reader.OneShape();
          addLog('  Shape type: ' + shape.ShapeType().value);
          addLog('  NbRoots: ' + reader.NbRootsForTransfer());
        }
        oc.FS.unlink('test.step');
      } catch (e) {
        addLog('  FEHLER: ' + e.message);
      }

      // --- Methode 2: Text + relativer Pfad ---
      addLog('');
      addLog('--- Methode 2: Text (String) + relativer Pfad "test2.step" ---');
      try {
        try { oc.FS.unlink('test2.step'); } catch {}
        oc.FS.writeFile('test2.step', text);
        const stat = oc.FS.stat('test2.step');
        addLog('  Geschrieben: ' + stat.size + ' bytes');

        const reader = new oc.STEPControl_Reader_1();
        const status = reader.ReadFile('test2.step');
        addLog('  Status.value: ' + status.value);

        if (status.value === 1) {
          addLog('  ERFOLG! TransferRoots...');
          reader.TransferRoots(new oc.Message_ProgressRange_1());
          const shape = reader.OneShape();
          addLog('  Shape type: ' + shape.ShapeType().value);
        }
        oc.FS.unlink('test2.step');
      } catch (e) {
        addLog('  FEHLER: ' + e.message);
      }

      // --- Methode 3: Binary + /tmp/ ---
      addLog('');
      addLog('--- Methode 3: Binary + absoluter Pfad "/tmp/test.step" ---');
      try {
        try { oc.FS.mkdir('/tmp'); } catch {}
        try { oc.FS.unlink('/tmp/test.step'); } catch {}
        oc.FS.writeFile('/tmp/test.step', uint8);
        const stat = oc.FS.stat('/tmp/test.step');
        addLog('  Geschrieben: ' + stat.size + ' bytes');

        const reader = new oc.STEPControl_Reader_1();
        const status = reader.ReadFile('/tmp/test.step');
        addLog('  Status.value: ' + status.value);

        if (status.value === 1) {
          addLog('  ERFOLG! TransferRoots...');
          reader.TransferRoots(new oc.Message_ProgressRange_1());
          const shape = reader.OneShape();
          addLog('  Shape type: ' + shape.ShapeType().value);
        }
        oc.FS.unlink('/tmp/test.step');
      } catch (e) {
        addLog('  FEHLER: ' + e.message);
      }

      // --- Methode 4: STEPCAFControl_Reader ---
      addLog('');
      addLog('--- Methode 4: STEPCAFControl_Reader ---');
      try {
        try { oc.FS.unlink('test4.step'); } catch {}
        oc.FS.writeFile('test4.step', uint8);

        // Verfuegbare Konstruktoren pruefen
        const cafClasses = [];
        for (const key of Object.getOwnPropertyNames(oc)) {
          if (key.includes('STEPCAFControl_Reader')) cafClasses.push(key);
        }
        addLog('  CAF Reader Klassen: ' + cafClasses.join(', '));

        if (oc.STEPCAFControl_Reader_1) {
          const cafReader = new oc.STEPCAFControl_Reader_1();
          const status = cafReader.ReadFile('test4.step');
          addLog('  Status.value: ' + status.value);
          if (status.value === 1) {
            addLog('  ERFOLG mit CAF Reader!');
          }
        }
        oc.FS.unlink('test4.step');
      } catch (e) {
        addLog('  FEHLER: ' + e.message);
      }

      // --- Methode 5: ReadFile mit ProgressRange ---
      addLog('');
      addLog('--- Methode 5: ReadFile + Message_ProgressRange ---');
      try {
        try { oc.FS.unlink('test5.step'); } catch {}
        oc.FS.writeFile('test5.step', uint8);

        const reader = new oc.STEPControl_Reader_1();
        // Pruefen ob ReadFile eine Overload mit ProgressRange hat
        addLog('  ReadFile.length: ' + reader.ReadFile.length);
        const pr = new oc.Message_ProgressRange_1();
        const status = reader.ReadFile('test5.step', pr);
        addLog('  Status.value (mit ProgressRange): ' + status?.value);
        if (status?.value === 1) {
          addLog('  ERFOLG!');
        }
        oc.FS.unlink('test5.step');
      } catch (e) {
        addLog('  FEHLER: ' + e.message);
      }

      // --- Methode 6: NbRootsForTransfer vor TransferRoots ---
      addLog('');
      addLog('--- Methode 6: Detaillierte ReadFile-Analyse ---');
      try {
        try { oc.FS.unlink('test6.step'); } catch {}
        oc.FS.writeFile('test6.step', uint8);

        const reader = new oc.STEPControl_Reader_1();
        const status = reader.ReadFile('test6.step');
        addLog('  Status.value: ' + status.value);
        addLog('  NbRootsForTransfer: ' + reader.NbRootsForTransfer());

        // Auch bei Status 2, versuche TransferRoots
        if (reader.NbRootsForTransfer() > 0) {
          addLog('  Versuche TransferRoots trotz Status ' + status.value + '...');
          try {
            reader.TransferRoots();
            const shape = reader.OneShape();
            addLog('  Shape erhalten! ShapeType: ' + shape.ShapeType().value);
            addLog('  IsNull: ' + shape.IsNull());
          } catch (e2) {
            addLog('  TransferRoots Fehler: ' + e2.message);
          }
        }
        oc.FS.unlink('test6.step');
      } catch (e) {
        addLog('  FEHLER: ' + e.message);
      }

      // --- Methode 7: Datei kuerzen (nur Header testen) ---
      addLog('');
      addLog('--- Methode 7: Datei-Struktur analysieren ---');
      try {
        // ENDSEC und DATA Positionen finden
        const headerEnd = text.indexOf('ENDSEC;');
        const dataStart = text.indexOf('DATA;');
        const dataEnd = text.lastIndexOf('ENDSEC;');
        const endIso = text.indexOf('END-ISO-10303-21;');
        addLog('  HEADER ENDSEC Position: ' + headerEnd);
        addLog('  DATA Start Position: ' + dataStart);
        addLog('  DATA ENDSEC Position: ' + dataEnd);
        addLog('  END-ISO Position: ' + endIso);
        addLog('  Datei endet mit: "' + text.slice(-30).replace(/\n/g, '\\n') + '"');

        // Entity-Typen zaehlen
        const entities = text.match(/#\d+\s*=\s*(\w+)/g);
        addLog('  Anzahl Entities: ' + (entities ? entities.length : 0));

        // Haeufigste Entity-Typen
        if (entities) {
          const typeCounts = {};
          for (const e of entities) {
            const type = e.match(/=\s*(\w+)/)[1];
            typeCounts[type] = (typeCounts[type] || 0) + 1;
          }
          const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
          addLog('  Top Entity-Typen: ' + sorted.map(([t, c]) => t + ':' + c).join(', '));
        }
      } catch (e) {
        addLog('  FEHLER: ' + e.message);
      }

      // --- Datei-Analyse (wie vorher) ---
      addLog('');
      addLog('--- Datei-Analyse ---');
      addLog('  Dateigroesse: ' + uint8.length + ' bytes');
      addLog('  Beginnt mit ISO-10303: ' + text.includes('ISO-10303-21'));
      addLog('  Enthaelt HEADER: ' + text.includes('HEADER'));
      addLog('  Enthaelt DATA: ' + text.includes('DATA'));
      addLog('  Enthaelt END-ISO: ' + text.includes('END-ISO-10303-21'));

      // AP-Version suchen
      const apMatch = text.match(/AP(\d{3})/);
      if (apMatch) addLog('  STEP AP-Version: AP' + apMatch[1]);

      // Schema suchen
      const schemaMatch = text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/);
      if (schemaMatch) addLog('  FILE_SCHEMA: ' + schemaMatch[1]);

      addLog('');
      addLog('=== Test abgeschlossen ===');

    } catch (e) {
      addLog('KRITISCHER FEHLER: ' + e.message);
      addLog(e.stack);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">OCCT STEP-Lese-Test</h1>
        <p className="text-gray-500 mt-1">
          Diagnose: Testet verschiedene Methoden zum Lesen von STEP-Dateien mit opencascade.js
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".step,.stp"
          className="hidden"
          onChange={(e) => e.target.files[0] && runTest(e.target.files[0])}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? 'Test laeuft...' : 'STEP/STP-Datei auswaehlen und testen'}
        </button>
      </div>

      {loading && (
        <div className="mb-4 flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
          <span className="text-gray-600">OpenCascade WASM wird geladen (kann 10-20 Sek. dauern)...</span>
        </div>
      )}

      {log && (
        <div className="bg-gray-900 rounded-xl p-6 overflow-auto max-h-[70vh]">
          <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">{log}</pre>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          Bitte den gesamten Log-Output kopieren und mir schicken.
          Status.value = 1 bedeutet Erfolg, alles andere ist ein Fehler.
        </p>
      </div>
    </div>
  );
}

export default OcctTest;
