import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Kalkulation from './pages/Kalkulation';
import Materialpreise from './pages/Materialpreise';
import Angebote from './pages/Angebote';
import NeuesBauteil from './pages/NeuesBauteil';
import Bibliothek from './pages/Bibliothek';
import OcctTest from './pages/OcctTest';
import Login from './pages/Login';
import Registrierung from './pages/Registrierung';

function App() {
  return (
    <Routes>
      {/* Oeffentliche Routen */}
      <Route path="/login" element={<Login />} />
      <Route path="/registrierung" element={<Registrierung />} />

      {/* Geschuetzte Routen mit Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="kalkulation" element={<Kalkulation />} />
        <Route path="materialpreise" element={<Materialpreise />} />
        <Route path="angebote" element={<Angebote />} />
        <Route path="neues-bauteil" element={<NeuesBauteil />} />
        <Route path="bibliothek" element={<Bibliothek />} />
        <Route path="occt-test" element={<OcctTest />} />
      </Route>
    </Routes>
  );
}

export default App;
