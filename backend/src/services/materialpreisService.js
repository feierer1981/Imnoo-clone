// Materialpreis-Service
// Verwaltet die verfuegbaren CNC-Materialien und deren Preise

// Stammdaten der verfuegbaren Materialien
const materialien = [
  {
    id: 1,
    name: 'Aluminium 6061',
    preisProKg: 4.50,
    einheit: 'EUR/kg',
    verfuegbarkeit: 'verfuegbar',
    lieferzeit: '2-3 Tage',
    kategorie: 'Leichtmetall',
    beschreibung: 'Vielseitig einsetzbares Aluminium mit guter Bearbeitbarkeit'
  },
  {
    id: 2,
    name: 'Stahl S235',
    preisProKg: 1.80,
    einheit: 'EUR/kg',
    verfuegbarkeit: 'verfuegbar',
    lieferzeit: '1-2 Tage',
    kategorie: 'Baustahl',
    beschreibung: 'Standard-Baustahl fuer allgemeine Anwendungen'
  },
  {
    id: 3,
    name: 'Edelstahl 1.4301',
    preisProKg: 5.20,
    einheit: 'EUR/kg',
    verfuegbarkeit: 'verfuegbar',
    lieferzeit: '3-5 Tage',
    kategorie: 'Edelstahl',
    beschreibung: 'Korrosionsbestaendiger austenitischer Edelstahl (V2A)'
  },
  {
    id: 4,
    name: 'Messing CuZn39Pb3',
    preisProKg: 8.90,
    einheit: 'EUR/kg',
    verfuegbarkeit: 'begrenzt',
    lieferzeit: '5-7 Tage',
    kategorie: 'Buntmetall',
    beschreibung: 'Gut zerspanbares Automaten-Messing'
  },
  {
    id: 5,
    name: 'Titan Grade 5',
    preisProKg: 35.00,
    einheit: 'EUR/kg',
    verfuegbarkeit: 'auf Anfrage',
    lieferzeit: '10-14 Tage',
    kategorie: 'Sondermetall',
    beschreibung: 'Hochfeste Titanlegierung (Ti6Al4V) fuer anspruchsvolle Anwendungen'
  }
];

/**
 * Gibt alle verfuegbaren Materialien mit Preisen zurueck
 * @returns {Array} Liste aller Materialien
 */
const getMaterialpreise = () => {
  return materialien;
};

/**
 * Gibt ein einzelnes Material anhand der ID zurueck
 * @param {number} id - Material-ID
 * @returns {Object|undefined} Gefundenes Material oder undefined
 */
const getMaterialById = (id) => {
  return materialien.find((m) => m.id === parseInt(id));
};

module.exports = { getMaterialpreise, getMaterialById };
