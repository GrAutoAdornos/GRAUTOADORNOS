// pages/admin/pedidos.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function PedidosAdmin() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('Todos');
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
      // Orden por llegada (más reciente primero)
      list.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));
      setPedidos(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const cambiarEstado = async (id, estado) => {
    await updateDoc(doc(db, 'pedidos', id), { estado });
    setPedidos(pedidos.map(p => p.id === id ? { ...p, estado } : p));
  };

  const enviarFacturaWhatsApp = (pedido) => {
    const telefonoLimpio = (pedido.clienteTelefono || '').replace(/[^0-9]/g, '');
    const mensaje = encodeURIComponent(
      `🧾 *FACTURA DE COMPRA - GR AUTO ADORNOS*\n` +
      `-----------------------------------\n` +
      `*Orden:* #${pedido.orderId || pedido.id}\n` +
      `*Cliente:* ${pedido.clienteNombre}\n` +
      `*Detalle:* ${pedido.detalles}\n` +
      `*Total:* RD$ ${pedido.total}\n` +
      `-----------------------------------\n` +
      `¡Gracias por preferirnos! Quedamos a tu disposición.`
    );
    window.open(`https://wa.me/1${telefonoLimpio}?text=${mensaje}`, '_blank');
  };

  const pedidosFiltrados = filtro === 'Todos' ? pedidos : pedidos.filter(p => p.estado === filtro);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>PEDIDOS & FACTURAS</span></span>
          <nav style={{ display: 'flex', gap: '8px' }}>
            <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}> Volver al Catálogo</Link>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '25px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', margin: 0 }}>Historial de Pedidos</h2>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ backgroundColor: '#141414', color: '#FFF', border: '1px solid #333', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
            <option value="Todos">Todos los Estados</option>
            <option value="Pendiente">🟡 Pendiente</option>
            <option value="Completado">🟢 Completado</option>
            <option value="Cancelado">🔴 Cancelado</option>
          </select>
        </div>

        {pedidosFiltrados.map((p) => (
          <div key={p.id} style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '18px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '10px' }}>
              <span style={{ fontWeight: 'bold', color: '#E50914' }}>Orden #{p.orderId || p.id}</span>
              <select value={p.estado || 'Pendiente'} onChange={(e) => cambiarEstado(p.id, e.target.value)} style={{ backgroundColor: '#181818', color: '#FFF', border: '1px solid #333', padding: '5px', borderRadius: '4px', fontSize: '11px' }}>
                <option value="Pendiente">🟡 Pendiente</option>
                <option value="Completado">🟢 Completado</option>
                <option value="Cancelado">🔴 Cancelado</option>
              </select>
            </div>
            
            <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Cliente:</strong> {p.clienteNombre} ({p.clienteTelefono})</p>
            <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Productos:</strong> {p.detalles}</p>
            <p style={{ margin: '4px 0', fontSize: '14px', color: '#25D366', fontWeight: 'bold' }}>Total: RD$ {p.total}</p>

            <button onClick={() => enviarFacturaWhatsApp(p)} style={{ backgroundColor: '#25D366', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
              📱 Enviar Factura a WhatsApp
            </button>
          </div>
        ))}
      </main>
    </div>
  );
}
