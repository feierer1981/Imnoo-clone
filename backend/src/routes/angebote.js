// Angebots-Routen
const express = require('express');
const router = express.Router();
const { getAll, create, getById, update } = require('../controllers/angebotController');

// GET /api/angebote - Alle Angebote abrufen
router.get('/', getAll);

// POST /api/angebote - Neues Angebot erstellen
router.post('/', create);

// GET /api/angebote/:id - Einzelnes Angebot abrufen
router.get('/:id', getById);

// PUT /api/angebote/:id - Angebot aktualisieren
router.put('/:id', update);

module.exports = router;
