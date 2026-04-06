const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");
const https = require("https");
const http = require("http");

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

// ─── Hilfsfunktion: URL → Buffer ─────────────────────────────────────────────
function fetchBuffer(url, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location, maxBytes).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      let size = 0;
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size > maxBytes) { res.destroy(); reject(new Error("Datei zu gross")); }
        chunks.push(chunk);
      });
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

// ─── kalkuliereTeile ─────────────────────────────────────────────────────────
exports.kalkuliereTeile = onCall(
  {
    region: "europe-west1",
    enforceAppCheck: true,
    secrets: ["CNC_CALC"],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Nicht eingeloggt.");

    const rolle = await getRole(request.auth.uid);
    if (rolle !== "admin" && rolle !== "user") {
      throw new HttpsError("permission-denied", "Zugriff verweigert.");
    }

    const { prompt, imageUrls, pdfUrls, stpUrls } = request.data || {};

    // Prompt validieren
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 10) {
      throw new HttpsError("invalid-argument", "Prompt ist zu kurz oder ungültig.");
    }
    if (prompt.length > 50000) {
      throw new HttpsError("invalid-argument", "Prompt ist zu lang (max 50.000 Zeichen).");
    }

    // URLs validieren (nur Firebase Storage URLs erlaubt)
    const validateUrls = (urls, label) => {
      if (!urls) return [];
      if (!Array.isArray(urls) || urls.length > 5) {
        throw new HttpsError("invalid-argument", `${label}: max 5 URLs.`);
      }
      for (const u of urls) {
        if (typeof u !== "string" || !u.startsWith("https://firebasestorage.googleapis.com/")) {
          throw new HttpsError("invalid-argument", `${label}: Ungültige URL.`);
        }
      }
      return urls;
    };

    const validImageUrls = validateUrls(imageUrls, "Bilder");
    const validPdfUrls = validateUrls(pdfUrls, "PDFs");
    const validStpUrls = validateUrls(stpUrls, "STP-Dateien");

    const apiKey = process.env.CNC_CALC;
    if (!apiKey) throw new HttpsError("internal", "Konfigurationsfehler.");

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // Multimodale Parts aufbauen
      const parts = [{ text: prompt.trim() }];

      // Bilder laden und als inline_data anhängen
      for (const url of validImageUrls) {
        try {
          const buf = await fetchBuffer(url);
          parts.push({
            inlineData: {
              mimeType: "image/png",
              data: buf.toString("base64"),
            },
          });
        } catch (err) {
          console.warn("Bild konnte nicht geladen werden:", err.message);
        }
      }

      // PDFs laden und als inline_data anhängen
      for (const url of validPdfUrls) {
        try {
          const buf = await fetchBuffer(url);
          parts.push({
            inlineData: {
              mimeType: "application/pdf",
              data: buf.toString("base64"),
            },
          });
        } catch (err) {
          console.warn("PDF konnte nicht geladen werden:", err.message);
        }
      }

      // STP-Dateien laden und als text/plain anhängen (STEP ist ASCII)
      for (const url of validStpUrls) {
        try {
          const buf = await fetchBuffer(url, 5 * 1024 * 1024); // max 5 MB
          parts.push({
            inlineData: {
              mimeType: "text/plain",
              data: buf.toString("base64"),
            },
          });
        } catch (err) {
          console.warn("STP-Datei konnte nicht geladen werden:", err.message);
        }
      }

      const result = await model.generateContent({ contents: [{ role: "user", parts }] });
      const text = result.response.text();

      // JSON aus der Antwort extrahieren
      let parsed = null;
      try {
        // Versuche direkt JSON zu parsen
        parsed = JSON.parse(text);
      } catch {
        // Versuche JSON aus Markdown-Codeblock zu extrahieren
        const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          try { parsed = JSON.parse(match[1].trim()); } catch { /* Fallback: Rohtext */ }
        }
      }

      console.log(JSON.stringify({
        event: "kalkuliereTeile_call",
        uid: request.auth.uid,
        rolle,
        promptLength: prompt.length,
        imageCount: validImageUrls.length,
        stpCount: validStpUrls.length,
        pdfCount: validPdfUrls.length,
        parsedOk: !!parsed,
        timestamp: new Date().toISOString(),
      }));

      return {
        success: true,
        ergebnis: parsed,
        rohtext: parsed ? null : text,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("Gemini Kalkulation Fehler:", err.message);
      throw new HttpsError("internal", "KI-Kalkulation fehlgeschlagen.");
    }
  }
);
