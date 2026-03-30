import axios from 'axios';

// Axios-Instanz mit Basis-URL fuer das Backend
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// --- Kalkulationen ---
export async function getKalkulationen() {
  // Mock-Daten bis Backend verfuegbar
  return [
    { id: 1, name: 'Gehaeuse A', material: 'Aluminium 6061', preis: 245.50, datum: '2026-03-28' },
    { id: 2, name: 'Welle B', material: 'Stahl S235', preis: 189.00, datum: '2026-03-27' },
    { id: 3, name: 'Flansch C', material: 'Edelstahl 1.4301', preis: 312.75, datum: '2026-03-26' },
  ];
}

export async function createKalkulation(data) {
  // Platzhalter fuer POST /api/kalkulationen
  return { id: Date.now(), ...data };
}

// --- Materialpreise ---
export async function getMaterialpreise() {
  return [
    { id: 1, name: 'Aluminium 6061', preisProKg: 8.50, verfuegbarkeit: 'Auf Lager', lieferzeit: '2-3 Tage' },
    { id: 2, name: 'Stahl S235', preisProKg: 3.20, verfuegbarkeit: 'Auf Lager', lieferzeit: '1-2 Tage' },
    { id: 3, name: 'Edelstahl 1.4301', preisProKg: 12.80, verfuegbarkeit: 'Auf Lager', lieferzeit: '3-5 Tage' },
    { id: 4, name: 'Messing CuZn39Pb3', preisProKg: 15.40, verfuegbarkeit: 'Begrenzt', lieferzeit: '5-7 Tage' },
    { id: 5, name: 'Titan Grade 5', preisProKg: 85.00, verfuegbarkeit: 'Auf Anfrage', lieferzeit: '10-14 Tage' },
  ];
}

// --- Angebote ---
export async function getAngebote() {
  return [
    { id: 'ANG-2026-001', kunde: 'Meier GmbH', bauteil: 'Gehaeuse A', preis: 2455.00, status: 'Angenommen', datum: '2026-03-25' },
    { id: 'ANG-2026-002', kunde: 'Schmidt AG', bauteil: 'Welle B', preis: 1890.00, status: 'Gesendet', datum: '2026-03-26' },
    { id: 'ANG-2026-003', kunde: 'Weber KG', bauteil: 'Flansch C', preis: 3127.50, status: 'Entwurf', datum: '2026-03-27' },
    { id: 'ANG-2026-004', kunde: 'Fischer OHG', bauteil: 'Adapter D', preis: 780.00, status: 'Abgelehnt', datum: '2026-03-20' },
  ];
}

// --- Authentifizierung ---
export async function loginApi(email, password) {
  // Platzhalter fuer POST /api/auth/login
  return { token: 'mock-jwt-token', user: { name: 'Max Mustermann', email, rolle: 'admin' } };
}

export async function registerApi(data) {
  // Platzhalter fuer POST /api/auth/register
  return { token: 'mock-jwt-token', user: { name: data.name, email: data.email, rolle: 'user' } };
}

export default api;
