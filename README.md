# CNC Kalkulator – Imnoo Clone

Modulare Web-Applikation für CNC-Kalkulationen, Materialpreis-Integration und Angebotserstellung.

## Projektstruktur

```
Imnoo-clone/
├── frontend/          # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/    # Wiederverwendbare Komponenten
│   │   ├── pages/         # Seitenkomponenten
│   │   ├── context/       # React Context (Auth)
│   │   └── services/      # API-Services
│   └── ...
├── backend/           # Node.js + Express
│   ├── src/
│   │   ├── routes/        # API-Routen
│   │   ├── controllers/   # Request-Handler
│   │   ├── services/      # Geschäftslogik
│   │   └── middleware/    # Auth-Middleware
│   └── ...
└── README.md
```

## Schnellstart

### Backend starten

```bash
cd backend
npm install
npm run dev
```

Der Server läuft auf **http://localhost:5000**.

### Frontend starten

```bash
cd frontend
npm install
npm run dev
```

Die App läuft auf **http://localhost:5173**.

## Features

- **Dashboard** – Übersicht über Kalkulationen, Angebote und Materialien
- **CNC-Kalkulation** – Automatische Berechnung von Maschinenzeit, Rüstzeit und Kosten
- **Materialpreise** – Übersicht mit Platzhalter für API-Integration
- **Angebote** – Verwaltung und Erstellung von Angeboten
- **Upload** – Platzhalter für CAD-/STEP-Datei-Upload
- **Benutzerverwaltung** – Login/Registrierung mit Rollensystem

## Berechnungslogik

| Parameter          | Formel                              |
|--------------------|-------------------------------------|
| Bearbeitungsvolumen | Länge × Breite × Höhe (cm³)       |
| Maschinenlaufzeit  | Volumen / 50 (min)                  |
| Rüstzeit           | 10 min (fix)                        |
| Programmierzeit    | 5 min (fix)                         |
| Stückpreis         | Gesamtzeit × 1,50 €/min            |

## Technologie-Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router, Axios
- **Backend:** Node.js, Express, CORS
