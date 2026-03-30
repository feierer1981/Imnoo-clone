// Angebots-Controller - Verwaltung der Kundenangebote

// Mock-Angebote mit verschiedenen Status
const mockAngebote = [
  {
    id: 1,
    nummer: 'ANG-2026-001',
    kunde: 'Meier GmbH',
    titel: 'Gehaeuseteile Aluminium',
    positionen: 3,
    gesamtbetrag: 1250.00,
    status: 'Entwurf',
    erstellt: '2026-03-10T08:00:00Z',
    gueltigBis: '2026-04-10T08:00:00Z'
  },
  {
    id: 2,
    nummer: 'ANG-2026-002',
    kunde: 'Schmidt & Partner KG',
    titel: 'Praezisionswellen Stahl',
    positionen: 5,
    gesamtbetrag: 3480.50,
    status: 'Gesendet',
    erstellt: '2026-03-15T11:30:00Z',
    gueltigBis: '2026-04-15T11:30:00Z'
  },
  {
    id: 3,
    nummer: 'ANG-2026-003',
    kunde: 'Technik AG',
    titel: 'Flansche Edelstahl Sonderfertigung',
    positionen: 2,
    gesamtbetrag: 890.00,
    status: 'Angenommen',
    erstellt: '2026-03-18T09:45:00Z',
    gueltigBis: '2026-04-18T09:45:00Z'
  },
  {
    id: 4,
    nummer: 'ANG-2026-004',
    kunde: 'Bauer Maschinenbau',
    titel: 'Titan-Bauteile Prototyp',
    positionen: 1,
    gesamtbetrag: 5200.00,
    status: 'Abgelehnt',
    erstellt: '2026-03-20T14:00:00Z',
    gueltigBis: '2026-04-20T14:00:00Z'
  }
];

/**
 * Alle Angebote abrufen
 */
const getAll = (req, res) => {
  try {
    res.status(200).json({
      erfolg: true,
      anzahl: mockAngebote.length,
      daten: mockAngebote
    });
  } catch (error) {
    res.status(500).json({
      erfolg: false,
      nachricht: 'Fehler beim Abrufen der Angebote',
      fehler: error.message
    });
  }
};

/**
 * Neues Angebot erstellen
 */
const create = (req, res) => {
  try {
    const { kunde, titel, positionen, gesamtbetrag } = req.body;

    // Eingabevalidierung
    if (!kunde || !titel) {
      return res.status(400).json({
        erfolg: false,
        nachricht: 'Kunde und Titel sind erforderlich'
      });
    }

    // Neues Angebot mit automatischer Nummernvergabe
    const neuesAngebot = {
      id: mockAngebote.length + 1,
      nummer: `ANG-2026-${String(mockAngebote.length + 1).padStart(3, '0')}`,
      kunde,
      titel,
      positionen: positionen || 0,
      gesamtbetrag: gesamtbetrag || 0,
      status: 'Entwurf',
      erstellt: new Date().toISOString(),
      gueltigBis: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    res.status(201).json({
      erfolg: true,
      nachricht: 'Angebot erfolgreich erstellt',
      daten: neuesAngebot
    });
  } catch (error) {
    res.status(500).json({
      erfolg: false,
      nachricht: 'Fehler beim Erstellen des Angebots',
      fehler: error.message
    });
  }
};

/**
 * Einzelnes Angebot nach ID abrufen
 */
const getById = (req, res) => {
  try {
    const { id } = req.params;
    const angebot = mockAngebote.find((a) => a.id === parseInt(id));

    if (!angebot) {
      return res.status(404).json({
        erfolg: false,
        nachricht: `Angebot mit ID ${id} nicht gefunden`
      });
    }

    res.status(200).json({
      erfolg: true,
      daten: angebot
    });
  } catch (error) {
    res.status(500).json({
      erfolg: false,
      nachricht: 'Fehler beim Abrufen des Angebots',
      fehler: error.message
    });
  }
};

/**
 * Angebot aktualisieren (z.B. Status aendern)
 */
const update = (req, res) => {
  try {
    const { id } = req.params;
    const angebot = mockAngebote.find((a) => a.id === parseInt(id));

    if (!angebot) {
      return res.status(404).json({
        erfolg: false,
        nachricht: `Angebot mit ID ${id} nicht gefunden`
      });
    }

    // Aktualisierte Daten zusammenfuehren
    const aktualisiert = {
      ...angebot,
      ...req.body,
      id: angebot.id,           // ID darf nicht geaendert werden
      nummer: angebot.nummer,   // Nummer darf nicht geaendert werden
      aktualisiert: new Date().toISOString()
    };

    res.status(200).json({
      erfolg: true,
      nachricht: 'Angebot erfolgreich aktualisiert',
      daten: aktualisiert
    });
  } catch (error) {
    res.status(500).json({
      erfolg: false,
      nachricht: 'Fehler beim Aktualisieren des Angebots',
      fehler: error.message
    });
  }
};

module.exports = { getAll, create, getById, update };
