// Kalkulations-Controller - Verwaltung der CNC-Kalkulationen
const { berechneKalkulation } = require('../services/kalkulationService');

// Mock-Kalkulationen fuer Testzwecke
const mockKalkulationen = [
  {
    id: 1,
    name: 'Gehaeuse Aluminium',
    material: 'Aluminium 6061',
    laenge: 100,
    breite: 50,
    hoehe: 30,
    stueckzahl: 10,
    stueckpreis: 27.00,
    gesamtpreis: 270.00,
    erstellt: '2026-03-15T10:30:00Z'
  },
  {
    id: 2,
    name: 'Welle Stahl',
    material: 'Stahl S235',
    laenge: 200,
    breite: 20,
    hoehe: 20,
    stueckzahl: 50,
    stueckpreis: 24.90,
    gesamtpreis: 1245.00,
    erstellt: '2026-03-20T14:15:00Z'
  },
  {
    id: 3,
    name: 'Flansch Edelstahl',
    material: 'Edelstahl 1.4301',
    laenge: 150,
    breite: 150,
    hoehe: 10,
    stueckzahl: 5,
    stueckpreis: 29.25,
    gesamtpreis: 146.25,
    erstellt: '2026-03-25T09:00:00Z'
  }
];

/**
 * Alle Kalkulationen abrufen
 */
const getAll = (req, res) => {
  try {
    res.status(200).json({
      erfolg: true,
      anzahl: mockKalkulationen.length,
      daten: mockKalkulationen
    });
  } catch (error) {
    res.status(500).json({
      erfolg: false,
      nachricht: 'Fehler beim Abrufen der Kalkulationen',
      fehler: error.message
    });
  }
};

/**
 * Neue Kalkulation erstellen
 * Verwendet den KalkulationService fuer die Berechnung
 */
const create = (req, res) => {
  try {
    const { laenge, breite, hoehe, stueckzahl, material, name } = req.body;

    // Eingabevalidierung
    if (!laenge || !breite || !hoehe || !stueckzahl) {
      return res.status(400).json({
        erfolg: false,
        nachricht: 'Laenge, Breite, Hoehe und Stueckzahl sind erforderlich'
      });
    }

    // Kalkulation durch den Service berechnen lassen
    const ergebnis = berechneKalkulation({ laenge, breite, hoehe, stueckzahl });

    const kalkulation = {
      id: mockKalkulationen.length + 1,
      name: name || 'Neue Kalkulation',
      material: material || 'Nicht angegeben',
      laenge,
      breite,
      hoehe,
      ...ergebnis,
      erstellt: new Date().toISOString()
    };

    res.status(201).json({
      erfolg: true,
      nachricht: 'Kalkulation erfolgreich erstellt',
      daten: kalkulation
    });
  } catch (error) {
    res.status(500).json({
      erfolg: false,
      nachricht: 'Fehler beim Erstellen der Kalkulation',
      fehler: error.message
    });
  }
};

/**
 * Einzelne Kalkulation nach ID abrufen
 */
const getById = (req, res) => {
  try {
    const { id } = req.params;
    const kalkulation = mockKalkulationen.find((k) => k.id === parseInt(id));

    if (!kalkulation) {
      return res.status(404).json({
        erfolg: false,
        nachricht: `Kalkulation mit ID ${id} nicht gefunden`
      });
    }

    res.status(200).json({
      erfolg: true,
      daten: kalkulation
    });
  } catch (error) {
    res.status(500).json({
      erfolg: false,
      nachricht: 'Fehler beim Abrufen der Kalkulation',
      fehler: error.message
    });
  }
};

module.exports = { getAll, create, getById };
