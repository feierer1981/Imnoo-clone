// Materialpreis-Routen
const express = require('express');
const router = express.Router();
const { getAll, getById } = require('../controllers/materialpreisController');

// GET /api/materialpreise - Alle Materialpreise abrufen
router.get('/', getAll);

// GET /api/materialpreise/:materialId - Einzelnes Material abrufen
router.get('/:materialId', getById);

module.exports = router;
