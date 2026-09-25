// pages/admin/metricas.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function MetricasAdmin() {
  const router = useRouter();
  const [ventas, setVentas] = useState(0);
  const [costos, setCostos] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) router.push('/admin/login');
    calcularMetricas();
  }, []);

  const calcularMetricas = async () => {
    const snapPedidos = await getDocs(collection(db, 'pedidos'));
    let totalVendido = 0;
    snapPedidos.forEach((doc) => {
      totalVendido += Number(doc.data().total || 0);
    });

    const snapProductos = await getDocs(collection(db, 'productos'));
    let totalInvertido = 0;
    snapProductos.forEach((doc) => {
      const p = doc.data();
      totalInvertido += (Number(p.costo || 0) * Number(p.stock || 0));
    });

    setVentas(totalVendido);
    setCostos(totalInvertido);
  };

  const gananciaNeta = ventas - costos;

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>MÉTRICAS & GANANCIAS</span></span>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>Volver al Catálogo</Link>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '25px 20px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Rendimiento Financiero</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
          <div style={{ backgroundColor: '#141414', border: '1px solid #222', padding: '20px', borderRadius: '10px' }}>
            <p style={{ color: '#AAA', fontSize: '12px', margin: 0 }}>Ventas Totales</p>
            <h3 style={{ fontSize: '22px', color: '#FFF', margin: '5px 0' }}>RD$ {ventas}</h3>
          </div>

          <div style={{ backgroundColor: '#141414', border: '1px solid #222', padding: '20px', borderRadius: '10px' }}>
            <p style={{ color: '#AAA', fontSize: '12px', margin: 0 }}>Capital en Stock</p>
            <h3 style={{ fontSize: '22px', color: '#FFCC00', margin: '5px 0' }}>RD$ {costos}</h3>
          </div>

          <div style={{ backgroundColor: '#141414', border: '1px solid #222', padding: '20px', borderRadius: '10px' }}>
            <p style={{ color: '#AAA', fontSize: '12px', margin: 0 }}>Margen de Ganancia Est.</p>
            <h3 style={{ fontSize: '22px', color: '#25D366', margin: '5px 0' }}>RD$ {gananciaNeta > 0 ? gananciaNeta : ventas}</h3>
          </div>
        </div>
      </main>
    </div>
  );
}
