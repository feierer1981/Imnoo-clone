// Authentifizierungs-Routen
const express = require('express');
const router = express.Router();
const { login, register } = require('../controllers/authController');

// POST /api/auth/login - Benutzer anmelden
router.post('/login', login);

// POST /api/auth/register - Neuen Benutzer registrieren
router.post('/register', register);

module.exports = router;
