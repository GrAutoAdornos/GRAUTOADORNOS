// pages/admin/citas.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function CitasAdmin() {
  const router = useRouter();
  const [citas, setCitas] = useState([]);

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) router.push('/admin/login');
    cargarCitas();
  }, []);

  const cargarCitas = async () => {
    const snap = await getDocs(collection(db, 'pedidos'));
    const list = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.fechaCita) list.push({ id: d.id, ...data });
    });
    setCitas(list);
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>CITAS E INSTALACIONES</span></span>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>Volver al Catálogo</Link>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '25px 20px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Agenda de Servicios Agendados</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
          {citas.map((c) => (
            <div key={c.id} style={{ backgroundColor: '#141414', border: '1px solid #E50914', padding: '15px', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#E50914', fontWeight: 'bold' }}>📅 {c.fechaCita} - 🕒 {c.horaCita}</p>
              <h4 style={{ margin: '5px 0' }}>{c.clienteNombre}</h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#AAA' }}>Servicio: {c.detalles}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
