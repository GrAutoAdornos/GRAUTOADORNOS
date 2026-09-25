// pages/admin/pedidos.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function PedidosAdmin() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) {
      router.push('/admin/login');
      return;
    }
    cargarPedidos();
  }, []);

  const cargarPedidos = async () => {
    try {
      const snap = await getDocs(collection(db, 'pedidos'));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setPedidos(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'pedidos', id), { estado: nuevoEstado });
      setPedidos((prev) => prev.map((p) => p.id === id ? { ...p, estado: nuevoEstado } : p));
    } catch (e) {
      alert("Error actualizando estado.");
    }
  };

  const borrarPedido = async (id) => {
    if (confirm("¿Seguro que deseas eliminar este pedido?")) {
      await deleteDoc(doc(db, 'pedidos', id));
      setPedidos((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      <header style={{ backgroundColor: '#000000', borderBottom: '2px solid #E50914', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>PANEL ADMIN</span></span>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' }}>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>
            📊 General
          </Link>
          <Link href="/admin/pedidos" style={{ backgroundColor: '#E50914', color: '#FFF', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>
            📦 Pedidos ({pedidos.length})
          </Link>
          <Link href="/admin/productos" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>
            🏷️ Productos
          </Link>
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Gestión de Pedidos</h1>

        {loading ? (
          <p style={{ color: '#888' }}>Cargando pedidos...</p>
        ) : pedidos.length === 0 ? (
          <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '12px', padding: '30px', textAlign: 'center', color: '#888' }}>No hay pedidos aún.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {pedidos.map((p) => (
              <div key={p.id} style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#E50914', fontSize: '16px' }}>#{p.orderId || p.id}</span>
                  <select 
                    value={p.estado || 'Pendiente'} 
                    onChange={(e) => cambiarEstado(p.id, e.target.value)}
                    style={{ backgroundColor: '#181818', color: '#FFF', border: '1px solid #333', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
                  >
                    <option value="Pendiente">🟡 Pendiente</option>
                    <option value="Completado">🟢 Completado</option>
                    <option value="Cancelado">🔴 Cancelado</option>
                  </select>
                </div>

                <div style={{ fontSize: '13px', color: '#DDD', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <p style={{ margin: 0 }}><strong>Cliente:</strong> {p.clienteNombre}</p>
                  <p style={{ margin: 0 }}><strong>Teléfono:</strong> {p.clienteTelefono}</p>
                  <p style={{ margin: 0 }}><strong>Total:</strong> <span style={{ color: '#25D366', fontWeight: 'bold' }}>RD$ {p.total}</span></p>
                  <p style={{ margin: 0 }}><strong>Detalles:</strong> {p.detalles}</p>
                  {p.fechaCita && <p style={{ margin: 0, color: '#ff4d4d' }}><strong>Cita:</strong> {p.fechaCita} - {p.horaCita}</p>}
                </div>

                <div style={{ textAlign: 'right', marginTop: '5px' }}>
                  <button onClick={() => borrarPedido(p.id)} style={{ backgroundColor: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑 Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
