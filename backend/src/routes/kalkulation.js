// Kalkulations-Routen
const express = require('express');
const router = express.Router();
const { getAll, create, getById } = require('../controllers/kalkulationController');

// GET /api/kalkulation - Alle Kalkulationen abrufen
router.get('/', getAll);

// POST /api/kalkulation - Neue Kalkulation erstellen
router.post('/', create);

// GET /api/kalkulation/:id - Einzelne Kalkulation abrufen
router.get('/:id', getById);

module.exports = router;
