const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

admin.initializeApp();

// Secret aus Google Cloud Secret Manager laden
const geminiApiKey = defineSecret("CNC-CALC");

/**
 * testGemini – Callable Cloud Function
 * Sendet einen Test-Prompt an Gemini und gibt die Antwort zurück.
 * Nur für authentifizierte Admins zugänglich.
 */
exports.testGemini = onCall(
  { secrets: [geminiApiKey], region: "europe-west1" },
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

    // Prompt aus dem Request oder Standard-Testprompt
    const prompt =
      request.data?.prompt ||
      "Du bist ein CNC-Kalkulationsassistent. Antworte kurz: Was sind die wichtigsten Faktoren bei der Berechnung von CNC-Fertigungskosten?";

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      return {
        success: true,
        model: "gemini-3.1-pro-preview",
        prompt,
        antwort: text,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.error("Gemini API Fehler:", err);
      throw new HttpsError(
        "internal",
        `Gemini API Fehler: ${err.message}`
      );
    }
  }
);
