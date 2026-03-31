// Test-Script: opencascade.js STEP-Lesung mit verschiedenen Methoden
// Im Browser ueber /occt-test.html aufrufbar

import { initOpenCascade } from 'opencascade.js';

async function testStepReading() {
  const log = (msg) => {
    console.log(msg);
    document.getElementById('log').textContent += msg + '\n';
  };

  log('OpenCascade WASM laden...');
  const oc = await initOpenCascade();
  log('Geladen. FS verfuegbar: ' + !!oc.FS);

  // Zeige alle verfuegbaren STEP-relevanten Klassen
  const stepClasses = [];
  for (const key of Object.getOwnPropertyNames(oc)) {
    if (key.includes('STEP') || key.includes('Step') || key.includes('XDE') ||
        key.includes('STEPCAFControl') || key.includes('IFSelect')) {
      stepClasses.push(key);
    }
  }
  log('STEP-relevante Klassen: ' + stepClasses.join(', '));

  // FS Verzeichnisstruktur pruefen
  try {
    const root = oc.FS.readdir('/');
    log('FS root: ' + root.join(', '));
  } catch (e) {
    log('FS root Fehler: ' + e.message);
  }

  // File-Input Handler
  window.testFile = async (file) => {
    log('\n--- Test mit: ' + file.name + ' (' + file.size + ' bytes) ---');

    // Als Binary lesen
    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    // Als Text lesen
    const text = await file.text();

    log('Erste 100 Zeichen: ' + text.substring(0, 100));

    // Methode 1: Binary, relativer Pfad
    try {
      log('\nMethode 1: Binary + relativer Pfad');
      try { oc.FS.unlink('test.step'); } catch {}
      oc.FS.writeFile('test.step', uint8);
      const stat = oc.FS.stat('test.step');
      log('  Datei geschrieben: ' + stat.size + ' bytes');

      const reader1 = new oc.STEPControl_Reader_1();
      const status1 = reader1.ReadFile('test.step');
      log('  Status: ' + JSON.stringify(status1));
      log('  Status.value: ' + status1.value);
    } catch (e) {
      log('  FEHLER: ' + e.message);
    }

    // Methode 2: Text-String, relativer Pfad
    try {
      log('\nMethode 2: Text + relativer Pfad');
      try { oc.FS.unlink('test2.step'); } catch {}
      oc.FS.writeFile('test2.step', text);
      const stat = oc.FS.stat('test2.step');
      log('  Datei geschrieben: ' + stat.size + ' bytes');

      const reader2 = new oc.STEPControl_Reader_1();
      const status2 = reader2.ReadFile('test2.step');
      log('  Status: ' + JSON.stringify(status2));
      log('  Status.value: ' + status2.value);
    } catch (e) {
      log('  FEHLER: ' + e.message);
    }

    // Methode 3: Binary, absoluter Pfad /tmp
    try {
      log('\nMethode 3: Binary + /tmp/ Pfad');
      try { oc.FS.mkdir('/tmp'); } catch {}
      try { oc.FS.unlink('/tmp/test.step'); } catch {}
      oc.FS.writeFile('/tmp/test.step', uint8);
      const stat = oc.FS.stat('/tmp/test.step');
      log('  Datei geschrieben: ' + stat.size + ' bytes');

      const reader3 = new oc.STEPControl_Reader_1();
      const status3 = reader3.ReadFile('/tmp/test.step');
      log('  Status: ' + JSON.stringify(status3));
      log('  Status.value: ' + status3.value);
    } catch (e) {
      log('  FEHLER: ' + e.message);
    }

    // Methode 4: STEPControl_Reader_2 (mit XSControl_WorkSession)
    try {
      log('\nMethode 4: STEPControl_Reader_2');
      const ws = new oc.XSControl_WorkSession();
      const reader4 = new oc.STEPControl_Reader_2(ws, false);
      const status4 = reader4.ReadFile('test.step');
      log('  Status: ' + JSON.stringify(status4));
      log('  Status.value: ' + status4.value);
    } catch (e) {
      log('  FEHLER: ' + e.message);
    }

    // IFSelect_ReturnStatus Werte auflisten
    log('\nIFSelect_ReturnStatus Enum-Werte:');
    try {
      const rs = oc.IFSelect_ReturnStatus;
      for (const key of Object.keys(rs)) {
        log('  ' + key + ' = ' + JSON.stringify(rs[key]));
      }
    } catch (e) {
      log('  FEHLER: ' + e.message);
    }
  };
}

testStepReading();
