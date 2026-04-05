const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

admin.initializeApp();

exports.testGemini = onRequest({ region: "europe-west1" }, async (req, res) => {
  // CORS Headers immer setzen
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Auth-Check via Firebase ID Token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Nicht eingeloggt." });
    return;
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(authHeader.slice(7));
  } catch (e) {
    res.status(401).json({ error: "Ungültiger Token." });
    return;
  }

  // Admin-Rolle prüfen
  const userDoc = await admin.firestore().doc(`users/${decodedToken.uid}`).get();
  if (!userDoc.exists || userDoc.data().rolle !== "admin") {
    res.status(403).json({ error: "Nur Admins dürfen diese Funktion nutzen." });
    return;
  }

  // API Key
  const apiKey = process.env.CNC_CALC;
  if (!apiKey) {
    res.status(500).json({ error: "API Key nicht gefunden (CNC_CALC)." });
    return;
  }

  const prompt =
    req.body?.prompt ||
    "Du bist ein CNC-Kalkulationsassistent. Antworte kurz: Was sind die wichtigsten Faktoren bei der Berechnung von CNC-Fertigungskosten?";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({
      success: true,
      model: "gemini-2.5-flash",
      prompt,
      antwort: text,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Gemini API Fehler:", err);
    res.status(500).json({ error: `Gemini API Fehler: ${err.message}` });
  }
});
