// Hauptserver-Datei fuer den CNC-Kalkulator
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routen einbinden
const authRoutes = require('./src/routes/auth');
const kalkulationRoutes = require('./src/routes/kalkulation');
const materialpreisRoutes = require('./src/routes/materialpreise');
const angeboteRoutes = require('./src/routes/angebote');

app.use('/api/auth', authRoutes);
app.use('/api/kalkulation', kalkulationRoutes);
app.use('/api/materialpreise', materialpreisRoutes);
app.use('/api/angebote', angeboteRoutes);

// Gesundheitscheck-Endpunkt
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    nachricht: 'CNC-Kalkulator Backend laeuft',
    zeitstempel: new Date().toISOString()
  });
});

// Globale Fehlerbehandlung
app.use((err, req, res, next) => {
  console.error('Serverfehler:', err.stack);
  res.status(500).json({
    erfolg: false,
    nachricht: 'Interner Serverfehler',
    fehler: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404-Handler fuer unbekannte Routen
app.use((req, res) => {
  res.status(404).json({
    erfolg: false,
    nachricht: `Route ${req.method} ${req.originalUrl} nicht gefunden`
  });
});

app.listen(PORT, () => {
  console.log(`CNC-Kalkulator Backend laeuft auf Port ${PORT}`);
});

module.exports = app;
