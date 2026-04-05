const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * testGemini – Callable Cloud Function
 * Sendet einen Test-Prompt an Gemini und gibt die Antwort zurück.
 * Nur für authentifizierte Admins zugänglich.
 */
exports.testGemini = onCall(
  { region: "europe-west1", cors: true },
  async (request) => {
    // Auth-Check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Nicht eingeloggt.");
    }

    // Admin-Rolle prüfen
    const userDoc = await admin
      .firestore()
      .doc(`users/${request.auth.uid}`)
      .get();
    if (!userDoc.exists || userDoc.data().rolle !== "admin") {
      throw new HttpsError("permission-denied", "Nur Admins dürfen diese Funktion nutzen.");
    }

    // API Key aus Secret Manager (via gcloud --set-secrets als CNC_CALC gemountet)
    const apiKey = process.env.CNC_CALC;
    if (!apiKey) {
      throw new HttpsError("internal", "API Key nicht gefunden (CNC_CALC).");
    }

    // Prompt aus dem Request oder Standard-Testprompt
    const prompt =
      request.data?.prompt ||
      "Du bist ein CNC-Kalkulationsassistent. Antworte kurz: Was sind die wichtigsten Faktoren bei der Berechnung von CNC-Fertigungskosten?";

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return {
        success: true,
        model: "gemini-2.0-flash",
        prompt,
        antwort: text,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.error("Gemini API Fehler:", err);
      throw new HttpsError("internal", `Gemini API Fehler: ${err.message}`);
    }
  }
);
