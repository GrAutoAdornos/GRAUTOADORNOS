// pages/admin/dashboard.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ productos: 0, stockBajo: 0, pedidos: 0 });
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/admin/login');
      } else {
        setUser(currentUser);
        await obtenerEstadisticas();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const obtenerEstadisticas = async () => {
    try {
      const prodSnap = await getDocs(collection(db, 'productos'));
      let totalProd = 0;
      let bajo = 0;

      prodSnap.forEach((doc) => {
        totalProd++;
        if (doc.data().stock <= 3) bajo++;
      });

      const pedSnap = await getDocs(collection(db, 'pedidos'));

      setStats({
        productos: totalProd,
        stockBajo: bajo,
        pedidos: pedSnap.size
      });
    } catch (error) {
      console.error("Error al obtener estadísticas:", error);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center text-xs">Cargando Panel...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col font-sans">
      {/* Topbar */}
      <header className="bg-black border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="text-lg font-black tracking-wider">GR ADMIN</span>
            <span className="text-[10px] bg-red-950 text-red-400 border border-[#E50914] px-2 py-0.5 rounded font-bold uppercase">
              Dashboard
            </span>
          </div>

          <button
            onClick={() => signOut(auth)}
            className="text-xs bg-red-950 border border-[#E50914] text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-900 transition font-bold"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-grow w-full space-y-8">
        <div>
          <h2 className="text-xl font-black">Bienvenido, {user?.email}</h2>
          <p className="text-xs text-gray-400 mt-1">Gestión general de inventario, ventas y citas de taller.</p>
        </div>

        {/* Tarjetas de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#181818] border border-gray-800 p-5 rounded-xl">
            <span className="text-xs text-gray-400 uppercase font-semibold">Total Productos</span>
            <p className="text-2xl font-black text-white mt-1">{stats.productos}</p>
          </div>

          <div className="bg-[#181818] border border-gray-800 p-5 rounded-xl">
            <span className="text-xs text-gray-400 uppercase font-semibold">Stock Crítico (≤3)</span>
            <p className={`text-2xl font-black mt-1 ${stats.stockBajo > 0 ? 'text-[#E50914]' : 'text-green-400'}`}>
              {stats.stockBajo}
            </p>
          </div>

          <div className="bg-[#181818] border border-gray-800 p-5 rounded-xl">
            <span className="text-xs text-gray-400 uppercase font-semibold">Pedidos Registrados</span>
            <p className="text-2xl font-black text-white mt-1">{stats.pedidos}</p>
          </div>
        </div>

        {/* Accesos Rápidos a Módulos */}
        <div>
          <h3 className="text-xs font-black uppercase text-gray-400 mb-4 tracking-wider">Módulos del Sistema</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/admin/productos" className="bg-[#181818] border border-gray-800 hover:border-[#E50914] p-5 rounded-2xl transition group">
              <h4 className="text-sm font-bold text-white group-hover:text-[#E50914] transition">📦 Inventario de Productos</h4>
              <p className="text-xs text-gray-400 mt-1">Agregar, editar precio, categorizar y ajustar stock.</p>
            </Link>

            <Link href="/admin/pedidos" className="bg-[#181818] border border-gray-800 hover:border-[#E50914] p-5 rounded-2xl transition group">
              <h4 className="text-sm font-bold text-white group-hover:text-[#E50914] transition">🧾 Pedidos y Facturación</h4>
              <p className="text-xs text-gray-400 mt-1">Revisar ventas y enviar comprobantes por WhatsApp.</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
