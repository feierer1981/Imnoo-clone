import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import Dashboard from './pages/Dashboard';
import Kalkulation from './pages/Kalkulation';
import Materialpreise from './pages/Materialpreise';
import Angebote from './pages/Angebote';
import NeuesBauteil from './pages/NeuesBauteil';
import Bibliothek from './pages/Bibliothek';
import Einstellungen from './pages/Einstellungen';
import OcctTest from './pages/OcctTest';
import Login from './pages/Login';
import Registrierung from './pages/Registrierung';
import Nutzer from './pages/Admin/Nutzer';
import Bibliotheken from './pages/Admin/Bibliotheken';
import PromptUebersicht from './pages/Admin/PromptUebersicht';
import KiTest from './pages/Admin/KiTest';

function App() {
  return (
    <Routes>
      {/* Oeffentliche Routen */}
      <Route path="/login" element={<Login />} />
      <Route path="/registrierung" element={<Registrierung />} />

      {/* Admin-Routen */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="/admin/nutzer" replace />} />
        <Route path="nutzer" element={<Nutzer />} />
        <Route path="bibliotheken" element={<Bibliotheken />} />
        <Route path="einstellungen/prompts" element={<PromptUebersicht />} />
        <Route path="ki-test" element={<KiTest />} />
      </Route>

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
        <Route path="einstellungen" element={<Einstellungen />} />
        <Route path="occt-test" element={<OcctTest />} />
      </Route>
    </Routes>
  );
}

export default App;
