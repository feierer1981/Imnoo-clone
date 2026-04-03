import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Admin wird automatisch zum Admin-Panel weitergeleitet
  if (user?.rolle === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  // Nutzer mit rolle "none" - Freischaltung ausstehend
  if (user?.rolle === 'none') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Freischaltung ausstehend</h2>
            <p className="text-gray-500 mb-4">
              Ihr Konto wurde erfolgreich erstellt. Ein Administrator muss Ihr Konto
              erst freischalten, bevor Sie das System nutzen koennen.
            </p>
            <p className="text-sm text-gray-400 mb-6">
              Angemeldet als: <span className="font-medium text-gray-600">{user.email}</span>
            </p>
            <button
              onClick={() => logout()}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Abmelden
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;
