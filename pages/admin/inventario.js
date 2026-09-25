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
    const snap = await getDocs(collection(db, 'productos'));
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    setProductos(list);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3>Estado de Existencias</h3>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ backgroundColor: '#141414', color: '#FFF', border: '1px solid #333', padding: '8px', borderRadius: '6px', fontSize: '12px' }}>
            <option value="Todas">Todas las Categorías</option>
            <option value="Accesorios">Accesorios</option>
            <option value="Iluminación">Iluminación</option>
            <option value="Audio">Audio</option>
            <option value="Pantallas & Cámaras">Pantallas & Cámaras</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
          {prodsFiltrados.map((p) => {
            const agotado = p.stock <= 0;
            const alertaBajo = p.stock > 0 && p.stock <= 3;

            return (
              <div key={p.id} style={{ backgroundColor: '#141414', border: `1px solid ${agotado ? '#E50914' : alertaBajo ? '#FFCC00' : '#222'}`, borderRadius: '10px', padding: '15px' }}>
                <h4 style={{ margin: '0 0 5px 0' }}>{p.nombre}</h4>
                <p style={{ fontSize: '12px', color: '#AAA', margin: 0 }}>Categoría: {p.categoria}</p>
                <div style={{ marginTop: '10px', fontSize: '14px', fontWeight: 'bold' }}>
                  {agotado ? (
                    <span style={{ color: '#E50914' }}>🚫 AGOTADO (Recomprar)</span>
                  ) : alertaBajo ? (
                    <span style={{ color: '#FFCC00' }}>⚠️ ¡Quedan solo {p.stock} unidades!</span>
                  ) : (
                    <span style={{ color: '#25D366' }}>✅ Disponible ({p.stock} ud.)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
