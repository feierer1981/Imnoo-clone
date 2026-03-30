// Authentifizierungs-Middleware
// Prueft ob ein gueltiger Authorization-Header vorhanden ist

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Pruefen ob der Authorization-Header vorhanden ist
    if (!authHeader) {
      return res.status(401).json({
        erfolg: false,
        nachricht: 'Kein Autorisierungs-Token vorhanden. Zugriff verweigert.'
      });
    }

    // Mock-Benutzer setzen (spaeter durch echte JWT-Validierung ersetzen)
    req.user = {
      id: 1,
      name: 'Max Mustermann',
      email: 'max@mustermann.de',
      rolle: 'admin'
    };

    next();
  } catch (error) {
    return res.status(401).json({
      erfolg: false,
      nachricht: 'Token ungueltig oder abgelaufen'
    });
  }
};

module.exports = authMiddleware;
