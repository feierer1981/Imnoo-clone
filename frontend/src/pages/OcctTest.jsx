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

      // --- Methode 4: Reader_2 mit WorkSession ---
      addLog('');
      addLog('--- Methode 4: STEPControl_Reader_2 + XSControl_WorkSession ---');
      try {
        try { oc.FS.unlink('test4.step'); } catch {}
        oc.FS.writeFile('test4.step', uint8);

        const ws = new oc.XSControl_WorkSession();
        const reader = new oc.STEPControl_Reader_2(ws, false);
        const status = reader.ReadFile('test4.step');
        addLog('  Status.value: ' + status.value);

        if (status.value === 1) {
          addLog('  ERFOLG!');
        }
        oc.FS.unlink('test4.step');
      } catch (e) {
        addLog('  FEHLER: ' + e.message);
      }

      // --- Methode 5: Nur mit .stp Extension ---
      addLog('');
      addLog('--- Methode 5: Binary + "model.stp" ---');
      try {
        try { oc.FS.unlink('model.stp'); } catch {}
        oc.FS.writeFile('model.stp', uint8);

        const reader = new oc.STEPControl_Reader_1();
        const status = reader.ReadFile('model.stp');
        addLog('  Status.value: ' + status.value);

        if (status.value === 1) {
          addLog('  ERFOLG!');
        }
        oc.FS.unlink('model.stp');
      } catch (e) {
        addLog('  FEHLER: ' + e.message);
      }

      // --- Methode 6: Datei-Inhalt pruefen ---
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
