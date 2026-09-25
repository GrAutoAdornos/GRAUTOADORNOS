// pages/admin/metricas.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function Metricas() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuth = localStorage.getItem('adminAuth');
      if (!isAuth) {
        router.push('/admin/login');
        return;
      }
      cargarDatos();
    }
  }, []);

  const cargarDatos = async () => {
    try {
      const snap = await getDocs(collection(db, 'pedidos'));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setPedidos(list);
    } catch (e) {
      console.error("Error al cargar métricas:", e);
    } finally {
      setLoading(false);
    }
  };

  const totalVentas = pedidos.reduce((acc, p) => acc + Number(p.total || 0), 0);
  const totalCosto = pedidos.reduce((acc, p) => acc + Number(p.costoTotal || 0), 0);
  const gananciaNeta = totalVentas - totalCosto;

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>ADMIN PANEL</span></span>
          
          <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>🛒 Catálogo</Link>
            <Link href="/admin/pedidos" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>📦 Pedidos / Facturas</Link>
            <Link href="/admin/inventario" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>📊 Inventario / Alertas</Link>
            <Link href="/admin/metricas" style={{ backgroundColor: '#E50914', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold' }}>📈 Métricas / Ganancias</Link>
            <Link href="/admin/clientes" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>👥 Clientes / CRM</Link>
            <Link href="/admin/citas" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>📅 Citas</Link>
            <Link href="/admin/proveedores" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>🏢 Proveedores</Link>
          </nav>

          <button onClick={() => { localStorage.removeItem('adminAuth'); router.push('/admin/login'); }} style={{ backgroundColor: '#222', color: '#ff4d4d', border: '1px solid #333', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Salir 🚪</button>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '25px 20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Métricas y Reporte de Ganancias</h1>

        {loading ? <p style={{ color: '#888' }}>Cargando métricas...</p> : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '30px' }}>
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', padding: '20px', borderRadius: '10px' }}>
                <p style={{ fontSize: '12px', color: '#AAA', margin: '0 0 5px' }}>Ingresos Totales</p>
                <h2 style={{ fontSize: '22px', color: '#25D366', margin: 0 }}>RD$ {totalVentas.toLocaleString()}</h2>
              </div>

              <div style={{ backgroundColor: '#141414', border: '1px solid #222', padding: '20px', borderRadius: '10px' }}>
                <p style={{ fontSize: '12px', color: '#AAA', margin: '0 0 5px' }}>Costo Estimado</p>
                <h2 style={{ fontSize: '22px', color: '#ff4d4d', margin: 0 }}>RD$ {totalCosto.toLocaleString()}</h2>
              </div>

              <div style={{ backgroundColor: '#141414', border: '1px solid #E50914', padding: '20px', borderRadius: '10px' }}>
                <p style={{ fontSize: '12px', color: '#AAA', margin: '0 0 5px' }}>Ganancia Neta</p>
                <h2 style={{ fontSize: '22px', color: '#E50914', margin: 0 }}>RD$ {gananciaNeta.toLocaleString()}</h2>
              </div>

              <div style={{ backgroundColor: '#141414', border: '1px solid #222', padding: '20px', borderRadius: '10px' }}>
                <p style={{ fontSize: '12px', color: '#AAA', margin: '0 0 5px' }}>Pedidos Totales</p>
                <h2 style={{ fontSize: '22px', color: '#FFF', margin: 0 }}>{pedidos.length}</h2>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
