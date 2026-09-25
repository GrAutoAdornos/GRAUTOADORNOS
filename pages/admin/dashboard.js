// pages/admin/dashboard.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function Dashboard() {
  const router = Router();
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAuth = localStorage.getItem('adminAuth');
    if (!isAuth) {
      router.push('/admin/login');
      return;
    }
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      const snapProds = await getDocs(collection(db, 'productos'));
      
      const listPedidos = [];
      snapPedidos.forEach((doc) => listPedidos.push({ id: doc.id, ...doc.data() }));
      
      const listProds = [];
      snapProds.forEach((doc) => listProds.push({ id: doc.id, ...doc.data() }));

      setPedidos(listPedidos);
      setProductos(listProds);
    } catch (e) {
      console.error("Error al cargar dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  const totalVentas = pedidos.reduce((acc, p) => acc + (Number(p.total) || 0), 0);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* Header Admin */}
      <header style={{ backgroundColor: '#000000', borderBottom: '2px solid #E50914', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>PANEL ADMIN</span></span>
        </div>
        <button 
          onClick={() => { localStorage.removeItem('adminAuth'); router.push('/admin/login'); }}
          style={{ backgroundColor: '#1F1F1F', color: '#ff4d4d', border: '1px solid #333', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
        >
          Cerrar Sesión 🚪
        </button>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' }}>
        
        {/* Menú de Navegación Admin */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#E50914', color: '#FFF', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>
            📊 General
          </Link>
          <Link href="/admin/pedidos" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>
            📦 Pedidos ({pedidos.length})
          </Link>
          <Link href="/admin/productos" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>
            🏷️ Productos ({productos.length})
          </Link>
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Resumen General</h1>

        {loading ? (
          <p style={{ color: '#888' }}>Cargando estadísticas...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            
            <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '12px', padding: '20px' }}>
              <p style={{ fontSize: '12px', color: '#AAA', margin: '0 0 5px' }}>Total en Ventas</p>
              <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#25D366', margin: 0 }}>RD$ {totalVentas}</h2>
            </div>

            <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '12px', padding: '20px' }}>
              <p style={{ fontSize: '12px', color: '#AAA', margin: '0 0 5px' }}>Pedidos Registrados</p>
              <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#E50914', margin: 0 }}>{pedidos.length}</h2>
            </div>

            <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '12px', padding: '20px' }}>
              <p style={{ fontSize: '12px', color: '#AAA', margin: '0 0 5px' }}>Productos en Catálogo</p>
              <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#FFF', margin: 0 }}>{productos.length}</h2>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
