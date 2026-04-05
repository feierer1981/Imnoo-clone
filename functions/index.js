const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

admin.initializeApp();

// ─── Auth-Hilfsfunktion ───────────────────────────────────────────────────────
async function getRole(uid) {
  // Custom Claim prüfen (primär)
  const user = await admin.auth().getUser(uid);
  let rolle = user.customClaims?.rolle || null;

  // Fallback: Firestore
  if (!rolle) {
    const snap = await admin.firestore().doc(`users/${uid}`).get();
    rolle = snap.exists ? snap.data()?.rolle : null;
  }
  return rolle;
}

// ─── syncUserClaims ───────────────────────────────────────────────────────────
exports.syncUserClaims = onCall(
  {
    region: "europe-west1",
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Nicht eingeloggt.");

    const rolle = await getRole(request.auth.uid);
    if (rolle !== "admin") throw new HttpsError("permission-denied", "Zugriff verweigert.");

    const { uid, rolle: newRolle } = request.data || {};
    const VALID_ROLLEN = ["none", "user", "admin"];
    if (!uid || typeof uid !== "string" || !VALID_ROLLEN.includes(newRolle)) {
      throw new HttpsError("invalid-argument", "Ungültige Parameter.");
    }

    await admin.auth().setCustomUserClaims(uid, { rolle: newRolle });

    console.log(JSON.stringify({
      event: "syncUserClaims",
      callerUid: request.auth.uid,
      targetUid: uid,
      rolle: newRolle,
      timestamp: new Date().toISOString(),
    }));

    return { success: true, uid, rolle: newRolle };
  }
);

// ─── testGemini ───────────────────────────────────────────────────────────────
exports.testGemini = onCall(
  {
    region: "europe-west1",
    enforceAppCheck: true,
    secrets: ["CNC_CALC"],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Nicht eingeloggt.");

    const rolle = await getRole(request.auth.uid);
    if (rolle !== "admin" && rolle !== "user") {
      throw new HttpsError("permission-denied", "Zugriff verweigert.");
    }

    const rawPrompt = request.data?.prompt;
    if (rawPrompt !== undefined && typeof rawPrompt !== "string") {
      throw new HttpsError("invalid-argument", "Ungültige Eingabe.");
    }
    const prompt = (
      rawPrompt ||
      "Du bist ein CNC-Kalkulationsassistent. Antworte kurz: Was sind die wichtigsten Faktoren bei der Berechnung von CNC-Fertigungskosten?"
    ).trim().slice(0, 2000);

    const apiKey = process.env.CNC_CALC;
    if (!apiKey) throw new HttpsError("internal", "Konfigurationsfehler.");

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      console.log(JSON.stringify({
        event: "testGemini_call",
        uid: request.auth.uid,
        rolle,
        promptLength: prompt.length,
        timestamp: new Date().toISOString(),
      }));

      return {
        success: true,
        model: "gemini-2.5-flash",
        prompt,
        antwort: text,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.error("Gemini API Fehler:", err.message);
      throw new HttpsError("internal", "KI-Anfrage fehlgeschlagen.");
    }
  }
);
