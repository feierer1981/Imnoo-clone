import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { useAuth } from '../context/AuthContext';

function AdminLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      <div className="flex-1 flex flex-col">
        {/* Kopfzeile */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-700">Verwaltung</h2>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              Admin
            </span>
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">{user?.name}</span>
            <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {user?.rolle}
            </span>
          </div>
        </header>

        {/* Inhaltsbereich */}
        <main className="flex-1 p-6 bg-gray-50 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
