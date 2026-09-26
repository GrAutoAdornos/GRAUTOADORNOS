// pages/admin/inventario.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function InventarioAdmin() {
  const router = useRouter();
  const [productos, setProductos] = useState([]);
  const [categoria, setCategoria] = useState('Todas');

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) router.push('/admin/login');
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const snap = await getDocs(collection(db, 'productos'));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setProductos(list);
    } catch (error) {
      console.error("Error al cargar inventario:", error);
    }
  };

  const prodsFiltrados = categoria === 'Todas' ? productos : productos.filter(p => p.categoria === categoria);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>INVENTARIO & ALERTAS</span></span>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>Volver al Catálogo</Link>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '25px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>Estado de Existencias</h3>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ backgroundColor: '#141414', color: '#FFF', border: '1px solid #333', padding: '8px', borderRadius: '6px', fontSize: '12px' }}>
            <option value="Todas">Todas las Categorías</option>
            <option value="Accesorios">Accesorios</option>
            <option value="Iluminación">Iluminación</option>
            <option value="Audio">Audio</option>
            <option value="Pantallas & Cámaras">Pantallas & Cámaras</option>
            <option value="Tintados">Tintados</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
          {prodsFiltrados.map((p) => {
            const stockActual = Number(p.stock ?? 0);
            const stockInicial = Number(p.stockInicial ?? stockActual);
            const vendidos = Math.max(0, stockInicial - stockActual);
            const pocoStock = stockActual > 0 && stockActual <= 2;
            const agotado = stockActual <= 0;

            return (
              <div 
                key={p.id} 
                style={{ 
                  backgroundColor: '#141414', 
                  border: agotado ? '1px solid #ff4d4d' : pocoStock ? '1px solid #FFB800' : '1px solid #222', 
                  borderRadius: '10px', 
                  padding: '18px' 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#FFF' }}>{p.nombre}</h4>
                  
                  {/* Estado Visual */}
                  {agotado ? (
                    <span style={{ fontSize: '11px', color: '#ff4d4d', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🚫 AGOTADO</span>
                  ) : pocoStock ? (
                    <span style={{ fontSize: '11px', color: '#FFB800', fontWeight: 'bold', whiteSpace: 'nowrap' }}>⚠️ ¡Poco stock!</span>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#25D366', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🟢 Stock Normal</span>
                  )}
                </div>

                <p style={{ fontSize: '12px', color: '#888', margin: '0 0 12px 0' }}>Categoría: {p.categoria || 'Sin Categoría'}</p>

                {/* Desglose de Unidades */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#AAA', borderTop: '1px solid #222', paddingTop: '10px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '10px', color: '#666' }}>INICIAL</span>
                    <strong style={{ color: '#FFF' }}>{stockInicial} unds.</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '10px', color: '#666' }}>VENDIDOS</span>
                    <strong style={{ color: '#E50914' }}>{vendidos} unds.</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '10px', color: '#666' }}>DISPONIBLE</span>
                    <strong style={{ color: '#25D366' }}>{stockActual} unds.</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
