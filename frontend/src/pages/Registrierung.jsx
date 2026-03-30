import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Registrierung() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    firmenname: '',
    passwort: '',
    passwortBestaetigen: '',
  });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validierung
    if (!form.name || !form.email || !form.passwort || !form.passwortBestaetigen) {
      setError('Bitte alle Pflichtfelder ausfuellen.');
      return;
    }

    if (form.passwort !== form.passwortBestaetigen) {
      setError('Die Passwoerter stimmen nicht ueberein.');
      return;
    }

    if (form.passwort.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    try {
      // Mock-Registrierung: Benutzer direkt anmelden
      await login(form.email, form.passwort);
      navigate('/');
    } catch {
      setError('Registrierung fehlgeschlagen.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Titel */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Konto erstellen</h1>
          <p className="text-gray-500 mt-1">Registrieren Sie sich fuer den CNC Kalkulator</p>
        </div>

        {/* Registrierungs-Karte */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Max Mustermann"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-Mail-Adresse *
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="max@beispiel.de"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Firmenname
              </label>
              <input
                type="text"
                name="firmenname"
                value={form.firmenname}
                onChange={handleChange}
                placeholder="Musterfirma GmbH (optional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Passwort *
              </label>
              <input
                type="password"
                name="passwort"
                value={form.passwort}
                onChange={handleChange}
                placeholder="Mindestens 6 Zeichen"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Passwort bestaetigen *
              </label>
              <input
                type="password"
                name="passwortBestaetigen"
                value={form.passwortBestaetigen}
                onChange={handleChange}
                placeholder="Passwort wiederholen"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm mt-2"
            >
              Registrieren
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Bereits ein Konto?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-medium">
              Jetzt anmelden
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Registrierung;
