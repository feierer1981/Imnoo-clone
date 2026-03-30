// API-Service mit Firebase Firestore
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

// --- Kalkulationen ---
export async function getKalkulationen() {
  try {
    const q = query(collection(db, 'kalkulationen'), orderBy('erstelltAm', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    // Fallback Mock-Daten wenn Firestore noch leer ist
    return [
      { id: '1', name: 'Gehaeuse A', material: 'Aluminium 6061', stueckzahl: 10, preis: 245.5, datum: '28.03.2026' },
      { id: '2', name: 'Welle B', material: 'Stahl S235', stueckzahl: 25, preis: 189.0, datum: '27.03.2026' },
      { id: '3', name: 'Flansch C', material: 'Edelstahl 1.4301', stueckzahl: 5, preis: 312.75, datum: '26.03.2026' },
    ];
  }
}

export async function createKalkulation(data) {
  const docRef = await addDoc(collection(db, 'kalkulationen'), {
    ...data,
    erstelltAm: serverTimestamp(),
  });
  return { id: docRef.id, ...data };
}

// --- Materialpreise ---
export async function getMaterialpreise() {
  try {
    const snapshot = await getDocs(collection(db, 'materialpreise'));
    if (snapshot.empty) throw new Error('leer');
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [
      { id: '1', name: 'Aluminium 6061', preisProKg: 4.5, verfuegbarkeit: 'Auf Lager', lieferzeit: '2-3 Tage' },
      { id: '2', name: 'Stahl S235', preisProKg: 1.8, verfuegbarkeit: 'Auf Lager', lieferzeit: '1-2 Tage' },
      { id: '3', name: 'Edelstahl 1.4301', preisProKg: 5.2, verfuegbarkeit: 'Auf Lager', lieferzeit: '3-5 Tage' },
      { id: '4', name: 'Messing CuZn39Pb3', preisProKg: 8.9, verfuegbarkeit: 'Begrenzt', lieferzeit: '5-7 Tage' },
      { id: '5', name: 'Titan Grade 5', preisProKg: 35.0, verfuegbarkeit: 'Auf Anfrage', lieferzeit: '10-14 Tage' },
    ];
  }
}

// --- Angebote ---
export async function getAngebote() {
  try {
    const q = query(collection(db, 'angebote'), orderBy('erstelltAm', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [
      { id: 'ANG-2026-001', kunde: 'Meier GmbH', bauteil: 'Gehaeuse A', preis: 2455.0, status: 'Angenommen', datum: '25.03.2026' },
      { id: 'ANG-2026-002', kunde: 'Schmidt AG', bauteil: 'Welle B', preis: 1890.0, status: 'Gesendet', datum: '26.03.2026' },
      { id: 'ANG-2026-003', kunde: 'Weber KG', bauteil: 'Flansch C', preis: 3127.5, status: 'Entwurf', datum: '27.03.2026' },
      { id: 'ANG-2026-004', kunde: 'Fischer OHG', bauteil: 'Adapter D', preis: 780.0, status: 'Abgelehnt', datum: '20.03.2026' },
    ];
  }
}

export async function createAngebot(data) {
  const docRef = await addDoc(collection(db, 'angebote'), {
    ...data,
    erstelltAm: serverTimestamp(),
  });
  return { id: docRef.id, ...data };
}
