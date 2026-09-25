// pages/admin/dashboard.js
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/admin/login');
      } else {
        setUser(currentUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center text-xs">
        Cargando Panel...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col font-sans">
      {/* Topbar */}
      <header className="bg-black border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="text-lg font-black tracking-wider">GR ADMIN</span>
            <span className="text-[10px] bg-red-950 text-red-400 border border-[#E50914] px-2 py-0.5 rounded font-bold uppercase">
              Control Center
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href="/"
              target="_blank"
              className="text-xs bg-gray-900 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition"
            >
              Ver Web
            </a>
            <button
              onClick={handleLogout}
              className="text-xs bg-[#E50914] text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Menú de Módulos */}
        <nav className="bg-[#181818] border-t border-gray-800 px-4">
          <div className="max-w-7xl mx-auto flex space-x-2 overflow-x-auto text-xs py-2">
            <Link href="/admin/productos" className="bg-[#E50914] text-white px-4 py-2 rounded-lg font-bold whitespace-nowrap">
              Productos & Categorías
            </Link>
            <Link href="/admin/pedidos" className="text-gray-400 hover:text-white px-4 py-2 rounded-lg font-bold whitespace-nowrap">
              Pedidos & Facturas
            </Link>
            <Link href="/admin/inventario" className="text-gray-400 hover:text-white px-4 py-2 rounded-lg font-bold whitespace-nowrap">
              Inventario & Alertas
            </Link>
            <Link href="/admin/metricas" className="text-gray-400 hover:text-white px-4 py-2 rounded-lg font-bold whitespace-nowrap">
              Métricas & Ganancias
            </Link>
            <Link href="/admin/clientes" className="text-gray-400 hover:text-white px-4 py-2 rounded-lg font-bold whitespace-nowrap">
              Clientes (CRM)
            </Link>
            <Link href="/admin/citas" className="text-gray-400 hover:text-white px-4 py-2 rounded-lg font-bold whitespace-nowrap">
              Citas Taller
            </Link>
          </div>
        </nav>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-grow w-full">
        <h2 className="text-xl font-black mb-2">Bienvenido al Panel de Control</h2>
        <p className="text-xs text-gray-400">
          Selecciona cualquiera de las secciones en el menú superior para administrar los servicios de GR Auto Adornos.
        </p>
      </main>
    </div>
  );
}