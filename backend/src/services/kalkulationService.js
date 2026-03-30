// Kalkulationsservice - Berechnung der CNC-Fertigungskosten
// Enthaelt die Kernlogik fuer die Preiskalkulation

/**
 * Berechnet die Kalkulation fuer ein CNC-Bauteil
 * @param {Object} params - Eingabeparameter
 * @param {number} params.laenge - Laenge des Bauteils in mm
 * @param {number} params.breite - Breite des Bauteils in mm
 * @param {number} params.hoehe - Hoehe des Bauteils in mm
 * @param {number} params.stueckzahl - Anzahl der zu fertigenden Teile
 * @returns {Object} Kalkulationsergebnis mit allen Zwischenwerten
 */
const berechneKalkulation = (params) => {
  const { laenge, breite, hoehe, stueckzahl } = params;

  // Bearbeitungsvolumen in cm³ berechnen (Eingabe in mm, daher /1000)
  const bearbeitungsvolumen = (laenge * breite * hoehe) / 1000;

  // Maschinenlaufzeit: Volumen geteilt durch Abtragrate (50 cm³/min)
  const maschinenlaufzeit = bearbeitungsvolumen / 50;

  // Fixe Nebenzeiten in Minuten
  const ruestzeit = 10;        // Zeit fuer Einrichten der Maschine
  const programmierzeit = 5;   // Zeit fuer CAM-Programmierung

  // Gesamtzeit pro Stueck = Maschinenlaufzeit + Nebenzeiten
  const gesamtzeit = maschinenlaufzeit + ruestzeit + programmierzeit;

  // Maschinenstundensatz: 1.50 EUR pro Minute
  const maschinenstundensatz = 1.50;
  const stueckpreis = gesamtzeit * maschinenstundensatz;

  // Gesamtpreis fuer die gesamte Stueckzahl
  const gesamtpreis = stueckpreis * stueckzahl;

  // Alle Werte auf 2 Nachkommastellen runden
  return {
    bearbeitungsvolumen: Math.round(bearbeitungsvolumen * 100) / 100,
    maschinenlaufzeit: Math.round(maschinenlaufzeit * 100) / 100,
    ruestzeit,
    programmierzeit,
    gesamtzeit: Math.round(gesamtzeit * 100) / 100,
    maschinenstundensatz,
    stueckpreis: Math.round(stueckpreis * 100) / 100,
    stueckzahl,
    gesamtpreis: Math.round(gesamtpreis * 100) / 100
  };
};

module.exports = { berechneKalkulation };
