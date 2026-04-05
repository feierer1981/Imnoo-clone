import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

function KiTest() {
  const [prompt, setPrompt] = useState(
    'Du bist ein CNC-Kalkulationsassistent. Antworte kurz: Was sind die wichtigsten Faktoren bei der Berechnung von CNC-Fertigungskosten?'
  );
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const testGemini = httpsCallable(functions, 'testGemini');
      const response = await testGemini({ prompt });
      setResult(response.data);
    } catch (err) {
      console.error('KI-Test Fehler:', err);
      setError(err.message || 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">KI-Schnittstellentest</h1>
        <p className="text-gray-500 mt-1">
          Testet die Verbindung zur Gemini API über Firebase Cloud Functions
        </p>
      </div>

      {/* Status-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium">Modell</p>
          <p className="text-lg font-bold text-gray-800 mt-1">gemini-2.5-flash</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium">Region</p>
          <p className="text-lg font-bold text-gray-800 mt-1">europe-west1</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium">Schutz</p>
          <p className="text-lg font-bold text-gray-800 mt-1">App Check + Auth</p>
          <p className="text-xs text-gray-400">reCAPTCHA Enterprise</p>
        </div>
      </div>

      {/* Prompt-Eingabe */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Test-Prompt</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none resize-y"
          placeholder="Prompt eingeben..."
        />
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleTest}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg transition-colors text-sm"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Wird gesendet...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Test senden
              </>
            )}
          </button>
          {loading && (
            <p className="text-xs text-gray-400">Die erste Anfrage kann bis zu 30 Sek. dauern (Cold Start)...</p>
          )}
        </div>
      </div>

      {/* Fehler */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-red-800 font-semibold text-sm">Fehler bei der API-Anfrage</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Ergebnis */}
      {result && (
        <div className="bg-white rounded-xl border border-green-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h3 className="text-green-800 font-semibold">Verbindung erfolgreich!</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-xs">
            <div className="bg-green-50 rounded-lg px-3 py-2">
              <span className="text-green-600 font-medium">Modell:</span>{' '}
              <span className="text-green-800">{result.model}</span>
            </div>
            <div className="bg-green-50 rounded-lg px-3 py-2">
              <span className="text-green-600 font-medium">Timestamp:</span>{' '}
              <span className="text-green-800">{new Date(result.timestamp).toLocaleString('de-DE')}</span>
            </div>
            <div className="bg-green-50 rounded-lg px-3 py-2">
              <span className="text-green-600 font-medium">Status:</span>{' '}
              <span className="text-green-800">{result.success ? 'OK' : 'Fehler'}</span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500 font-medium mb-2">Antwort der KI:</p>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {result.antwort}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 mt-4">
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-700 font-medium">Gesendeter Prompt anzeigen</summary>
              <pre className="mt-2 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap text-gray-600">{result.prompt}</pre>
            </details>
          </div>
        </div>
      )}

      {/* Info-Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-800 font-medium text-sm mb-2">Sicherheitsarchitektur</h3>
        <div className="text-xs text-blue-700 space-y-1">
          <p>1. App Check (reCAPTCHA Enterprise) – blockiert Bots & direkte API-Aufrufe</p>
          <p>2. Firebase Auth (ID Token) – nur eingeloggte Nutzer</p>
          <p>3. Custom Claims – nur Rollen admin/user</p>
          <p>4. Anfrage an <code>gemini-2.5-flash</code> in europe-west1</p>
        </div>
      </div>
    </div>
  );
}

export default KiTest;
