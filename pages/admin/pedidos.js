// pages/admin/pedidos.js
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase'; // Ajusta la ruta a tu archivo firebase según corresponda

export default function HistorialPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  useEffect(() => {
    cargarPedidos();
  }, []);

  const cargarPedidos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'pedidos'));
      const list = [];
      querySnapshot.forEach((documento) => {
        list.push({ id: documento.id, ...documento.data() });
      });
      setPedidos(list);
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Función para eliminar orden
  const handleEliminarPedido = async (id, orderId) => {
    const confirmar = window.confirm(`¿Estás seguro de que deseas eliminar la orden #${orderId}? Esta acción no se puede deshacer.`);
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, 'pedidos', id));
      setPedidos((prev) => prev.filter((item) => item.id !== id));
      alert(`Orden #${orderId} eliminada correctamente.`);
    } catch (error) {
      console.error("Error al eliminar pedido:", error);
      alert("Hubo un error al intentar eliminar la orden.");
    }
  };

  // Función para actualizar estado del pedido
  const handleCambiarEstado = async (id, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'pedidos', id), { estado: nuevoEstado });
      setPedidos((prev) =>
        prev.map((item) => (item.id === id ? { ...item, estado: nuevoEstado } : item))
      );
    } catch (error) {
      console.error("Error al cambiar estado:", error);
    }
  };

  const pedidosFiltrados = pedidos.filter((p) => {
    if (filtroEstado === 'Todos') return true;
    return p.estado === filtroEstado;
  });

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', padding: '30px 20px', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E50914', paddingBottom: '15px', marginBottom: '25px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#E50914', textTransform: 'uppercase', margin: 0 }}>
          GR Pedidos & Facturas
        </h1>
        <button onClick={() => window.location.href = '/'} style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
          Volver al Catálogo
        </button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>Historial de Pedidos</h2>
          
          {/* Filtro por estado */}
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ backgroundColor: '#1A1A1A', color: '#FFF', border: '1px solid #333', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', outline: 'none' }}>
            <option value="Todos">Todos los Estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Completado">Completado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>Cargando pedidos...</p>
        ) : pedidosFiltrados.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px 0', backgroundColor: '#141414', borderRadius: '8px', border: '1px solid #222' }}>No hay pedidos registrados.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {pedidosFiltrados.map((pedido) => (
              <div key={pedido.id} style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#E50914', margin: 0 }}>
                    Orden #{pedido.orderId}
                  </h3>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <select
                      value={pedido.estado || 'Pendiente'}
                      onChange={(e) => handleCambiarEstado(pedido.id, e.target.value)}
                      style={{ backgroundColor: '#1A1A1A', color: '#FFB800', border: '1px solid #333', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      <option value="Pendiente">🟡 Pendiente</option>
                      <option value="Completado">🟢 Completado</option>
                      <option value="Cancelado">🔴 Cancelado</option>
                    </select>

                    {/* Botón de Eliminar */}
                    <button
                      onClick={() => handleEliminarPedido(pedido.id, pedido.orderId)}
                      style={{ backgroundColor: '#330000', color: '#ff4d4d', border: '1px solid #ff4d4d', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: '#DDD', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <p style={{ margin: 0 }}><strong>Cliente:</strong> {pedido.clienteNombre} ({pedido.clienteTelefono})</p>
                  <p style={{ margin: 0 }}><strong>Productos:</strong> {pedido.detalles}</p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '900', color: '#25D366', marginTop: '4px' }}>
                    Total: RD$ {pedido.total}
                  </p>
                </div>

                <div>
                  <button
                    onClick={() => {
                      const msg = `Hola ${pedido.clienteNombre}, te contactamos de GR Auto Adornos con relación a tu Pedido #${pedido.orderId}.`;
                      window.open(`https://wa.me/1${pedido.clienteTelefono}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    style={{ backgroundColor: '#25D366', color: '#000', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    💬 Enviar Factura a WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
