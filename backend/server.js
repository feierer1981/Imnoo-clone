// Hauptserver-Datei fuer den CNC-Kalkulator
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Frontend-Build ausliefern (Production-Modus)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

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

// Alle nicht-API-Routen an das Frontend weiterleiten (SPA-Fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`CNC-Kalkulator Backend laeuft auf Port ${PORT}`);
});

module.exports = app;
