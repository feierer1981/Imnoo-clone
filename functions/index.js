const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

admin.initializeApp();

// ─── Erlaubte Origins ─────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://cnc-calc-9b89b.web.app",
  "https://cnc-calc-9b89b.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");
  res.set("Vary", "Origin");
}

// ─── Auth-Hilfsfunktion ───────────────────────────────────────────────────────
async function verifyAndGetRole(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentifizierung erforderlich." });
    return null;
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
  } catch {
    res.status(401).json({ error: "Ungültiger oder abgelaufener Token." });
    return null;
  }

  // Custom Claim prüfen (primär – schnell, kryptografisch)
  let rolle = decoded.rolle || null;

  // Fallback: Firestore (für Nutzer ohne aktuellen Custom Claim)
  if (!rolle) {
    try {
      const snap = await admin.firestore().doc(`users/${decoded.uid}`).get();
      rolle = snap.exists ? snap.data()?.rolle : null;
    } catch {
      // Firestore nicht erreichbar – kein Zugriff
    }
  }

  return { uid: decoded.uid, email: decoded.email, rolle };
}

// ─── syncUserClaims ───────────────────────────────────────────────────────────
// Setzt Firebase Custom Claims wenn Admin eine Rolle ändert.
// Wird vom Admin-Panel aufgerufen.
exports.syncUserClaims = onRequest({ region: "europe-west1" }, async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const caller = await verifyAndGetRole(req, res);
  if (!caller) return;

  if (caller.rolle !== "admin") {
    res.status(403).json({ error: "Zugriff verweigert." });
    return;
  }

  const { uid, rolle } = req.body || {};
  const VALID_ROLLEN = ["none", "user", "admin"];

  if (!uid || typeof uid !== "string" || !VALID_ROLLEN.includes(rolle)) {
    res.status(400).json({ error: "Ungültige Parameter." });
    return;
  }

  try {
    await admin.auth().setCustomUserClaims(uid, { rolle });
    console.log(JSON.stringify({
      event: "syncUserClaims",
      callerUid: caller.uid,
      targetUid: uid,
      rolle,
      timestamp: new Date().toISOString(),
    }));
    res.json({ success: true, uid, rolle });
  } catch (err) {
    console.error("setCustomUserClaims Fehler:", err.message);
    res.status(500).json({ error: "Custom Claims konnten nicht gesetzt werden." });
  }
});

// ─── testGemini ───────────────────────────────────────────────────────────────
// Zugänglich für Nutzer mit rolle 'admin' oder 'user'.
// Auth via Firebase ID Token, Rolle via Custom Claims (Fallback: Firestore).
exports.testGemini = onRequest({ region: "europe-west1" }, async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const caller = await verifyAndGetRole(req, res);
  if (!caller) return;

  if (caller.rolle !== "admin" && caller.rolle !== "user") {
    res.status(403).json({ error: "Zugriff verweigert." });
    return;
  }

  // Input-Validierung
  const rawPrompt = req.body?.prompt;
  if (rawPrompt !== undefined && typeof rawPrompt !== "string") {
    res.status(400).json({ error: "Ungültige Eingabe." });
    return;
  }
  const prompt = (
    rawPrompt ||
    "Du bist ein CNC-Kalkulationsassistent. Antworte kurz: Was sind die wichtigsten Faktoren bei der Berechnung von CNC-Fertigungskosten?"
  ).trim().slice(0, 2000); // Max. 2000 Zeichen

  const apiKey = process.env.CNC_CALC;
  if (!apiKey) {
    console.error("CNC_CALC Secret nicht gefunden");
    res.status(500).json({ error: "Konfigurationsfehler." });
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Audit-Log (Cloud Logging)
    console.log(JSON.stringify({
      event: "testGemini_call",
      uid: caller.uid,
      rolle: caller.rolle,
      promptLength: prompt.length,
      timestamp: new Date().toISOString(),
    }));

    res.json({
      success: true,
      model: "gemini-2.5-flash",
      prompt,
      antwort: text,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Gemini API Fehler:", err.message);
    res.status(500).json({ error: "KI-Anfrage fehlgeschlagen." });
  }
});
