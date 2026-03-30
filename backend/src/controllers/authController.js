// Auth-Controller - Authentifizierung und Benutzerverwaltung

/**
 * Benutzer-Login
 * Gibt einen Mock-Token und Benutzerdaten zurueck
 */
const login = (req, res) => {
  try {
    const { email, passwort } = req.body;

    // Eingabevalidierung
    if (!email || !passwort) {
      return res.status(400).json({
        erfolg: false,
        nachricht: 'E-Mail und Passwort sind erforderlich'
      });
    }

    // Mock-Authentifizierung (spaeter durch echte DB-Abfrage ersetzen)
    const benutzer = {
      id: 1,
      name: 'Max Mustermann',
      email: email,
      rolle: 'admin'
    };

    // Mock-Token generieren
    const token = 'mock-jwt-token-' + Date.now();

    res.status(200).json({
      erfolg: true,
      nachricht: 'Anmeldung erfolgreich',
      token,
      benutzer
    });
  } catch (error) {
    res.status(500).json({
      erfolg: false,
      nachricht: 'Fehler bei der Anmeldung',
      fehler: error.message
    });
  }
};

/**
 * Neuen Benutzer registrieren
 * Gibt eine Mock-Erfolgsmeldung zurueck
 */
const register = (req, res) => {
  try {
    const { name, email, passwort } = req.body;

    // Eingabevalidierung
    if (!name || !email || !passwort) {
      return res.status(400).json({
        erfolg: false,
        nachricht: 'Name, E-Mail und Passwort sind erforderlich'
      });
    }

    // Mock-Registrierung (spaeter durch echte DB-Logik ersetzen)
    res.status(201).json({
      erfolg: true,
      nachricht: 'Registrierung erfolgreich. Sie koennen sich jetzt anmelden.',
      benutzer: {
        id: 2,
        name,
        email,
        rolle: 'benutzer'
      }
    });
  } catch (error) {
    res.status(500).json({
      erfolg: false,
      nachricht: 'Fehler bei der Registrierung',
      fehler: error.message
    });
  }
};

module.exports = { login, register };
