// pages/admin/clientes.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function ClientesCRM() {
  const router = useRouter();
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) router.push('/admin/login');
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    const snap = await getDocs(collection(db, 'pedidos'));
    const mapa = {};
    snap.forEach((d) => {
      const p = d.data();
      if (p.clienteTelefono) {
        mapa[p.clienteTelefono] = {
          nombre: p.clienteNombre || 'Cliente',
          telefono: p.clienteTelefono,
          ultimaCompra: p.fechaCreacion || new Date().toISOString()
        };
      }
    });
    setClientes(Object.values(mapa));
  };

  const enviarRecordatorio = (cliente) => {
    const tel = cliente.telefono.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(`Hola ${cliente.nombre}, ¡en GR Auto Adornos nos acordamos de ti! 🚗🔥 ¿Cómo ha funcionado todo con tu última compra? Pasa por nuestra web a ver los nuevos accesorios que nos llegaron.`);
    window.open(`https://wa.me/1${tel}?text=${msg}`, '_blank');
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>CRM & FIDELIZACIÓN</span></span>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>Volver al Catálogo</Link>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '25px 20px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Base de Clientes Reincidentes</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {clientes.map((c, i) => (
            <div key={i} style={{ backgroundColor: '#141414', border: '1px solid #222', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0 }}>{c.nombre}</h4>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>Teléfono: {c.telefono}</p>
              </div>
              <button onClick={() => enviarRecordatorio(c)} style={{ backgroundColor: '#25D366', color: '#FFF', border: 'none', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                📱 Enviar Fidelización (15 días)
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
