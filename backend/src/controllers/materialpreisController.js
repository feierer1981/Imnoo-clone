// Materialpreis-Controller - Verwaltung der Materialpreise
const { getMaterialpreise, getMaterialById } = require('../services/materialpreisService');

/**
 * Alle Materialien mit Preisen abrufen
 */
const getAll = (req, res) => {
  try {
    const materialien = getMaterialpreise();

    res.status(200).json({
      erfolg: true,
      anzahl: materialien.length,
      daten: materialien
    });
  } catch (error) {
    res.status(500).json({
      erfolg: false,
      nachricht: 'Fehler beim Abrufen der Materialpreise',
      fehler: error.message
    });
  }
};

/**
 * Einzelnes Material nach ID abrufen
 */
const getById = (req, res) => {
  try {
    const { materialId } = req.params;
    const material = getMaterialById(materialId);

    if (!material) {
      return res.status(404).json({
        erfolg: false,
        nachricht: `Material mit ID ${materialId} nicht gefunden`
      });
    }

    res.status(200).json({
      erfolg: true,
      daten: material
    });
  } catch (error) {
    res.status(500).json({
      erfolg: false,
      nachricht: 'Fehler beim Abrufen des Materials',
      fehler: error.message
    });
  }
};

module.exports = { getAll, getById };
