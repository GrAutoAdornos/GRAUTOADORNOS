// pages/admin/pedidos.js
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, addDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../lib/firebase'; // Ajusta la ruta a tu archivo firebase según corresponda

export default function HistorialPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  // Estados para el Modal de Crear Pedido Manual
  const [mostrarModal, setMostrarModal] = useState(false);
  const [productosInventario, setProductosInventario] = useState([]);
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [direccionCliente, setDireccionCliente] = useState('');
  
  // Ítems seleccionados para el pedido manual: [{ id, nombre, precio, stock, cantidadSeleccionada }]
  const [itemsSeleccionados, setItemsSeleccionados] = useState([]);
  const [guardandoPedido, setGuardandoPedido] = useState(false);

  useEffect(() => {
    cargarPedidos();
    cargarInventario();
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

  const cargarInventario = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'productos')); // Asume que tu colección de inventario se llama 'productos'
      const list = [];
      querySnapshot.forEach((documento) => {
        list.push({ id: documento.id, ...documento.data() });
      });
      setProductosInventario(list);
    } catch (error) {
      console.error("Error al cargar inventario:", error);
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

  // Agregar producto al pedido manual
  const agregarProductoAlPedido = (producto) => {
    setItemsSeleccionados((prev) => {
      const existe = prev.find((item) => item.id === producto.id);
      if (existe) {
        return prev.map((item) =>
          item.id === producto.id
            ? { ...item, cantidadSeleccionada: Math.min(item.cantidadSeleccionada + 1, producto.stock ?? 99) }
            : item
        );
      } else {
        return [...prev, { ...producto, cantidadSeleccionada: 1 }];
      }
    });
  };

  // Cambiar cantidad de un ítem en el pedido manual
  const cambiarCantidadItem = (id, delta) => {
    setItemsSeleccionados((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nuevaCant = item.cantidadSeleccionada + delta;
          if (nuevaCant <= 0) return null;
          if (nuevaCant > (item.stock ?? 99)) {
            alert("No hay suficiente stock disponible.");
            return item;
          }
          return { ...item, cantidadSeleccionada: nuevaCant };
        }
        return item;
      }).filter(Boolean)
    );
  };

  // Calcular total del pedido manual
  const calcularTotalManual = () => {
    return itemsSeleccionados.reduce((acc, item) => acc + (Number(item.precio || item.price || 0) * item.cantidadSeleccionada), 0);
  };

  // Guardar pedido manual en Firebase, descontar stock e impactar métricas/CRM
  const handleCrearPedidoManual = async (e) => {
    e.preventDefault();
    if (!nombreCliente || !telefonoCliente || itemsSeleccionados.length === 0) {
      alert("Por favor completa el nombre, teléfono y selecciona al menos un producto.");
      return;
    }

    setGuardandoPedido(true);
    try {
      const orderId = Math.floor(100000 + Math.random() * 900000).toString();
      const total = calcularTotalManual();
      const detallesTexto = itemsSeleccionados.map(i => `${i.cantidadSeleccionada}x ${i.nombre || i.titulo}`).join(', ');

      // Usamos una transacción de Firebase para asegurar que se descuente el inventario de forma segura
      await runTransaction(db, async (transaction) => {
        // 1. Verificar y preparar el descuento de stock para cada producto
        for (const item of itemsSeleccionados) {
          const prodRef = doc(db, 'productos', item.id);
          const prodDoc = await transaction.get(prodRef);
          if (!prodDoc.exists()) {
            throw new Error(`El producto ${item.nombre} ya no existe en el inventario.`);
          }
          const stockActual = Number(prodDoc.data().stock ?? 0);
          if (stockActual < item.cantidadSeleccionada) {
            throw new Error(`Stock insuficiente para el producto: ${item.nombre || item.titulo}`);
          }
          transaction.update(prodRef, { stock: stockActual - item.cantidadSeleccionada });
        }

        // 2. Crear el documento del pedido
        const nuevoPedidoRef = doc(collection(db, 'pedidos'));
        transaction.set(nuevoPedidoRef, {
          orderId: orderId,
          clienteNombre: nombreCliente,
          clienteTelefono: telefonoCliente,
          direccion: direccionCliente || 'Retirado en tienda / No especificada',
          detalles: detallesTexto,
          productosDetalle: itemsSeleccionados.map(i => ({
            id: i.id,
            nombre: i.nombre || i.titulo,
            precio: Number(i.precio || i.price || 0),
            cantidad: i.cantidadSeleccionada
          })),
          total: total,
          estado: 'Pendiente',
          fidelizacionContactado: false,
          fecha: new Date(),
          origen: 'Manual (WhatsApp/Llamada)'
        });
      });

      alert(`¡Pedido #${orderId} creado con éxito y stock descontado!`);
      setMostrarModal(false);
      setNombreCliente('');
      setTelefonoCliente('');
      setDireccionCliente('');
      setItemsSeleccionados([]);
      cargarPedidos();
      cargarInventario();
    } catch (error) {
      console.error("Error al crear pedido manual:", error);
      alert("Error: " + error.message);
    } finally {
      setGuardandoPedido(false);
    }
  };

  const pedidosFiltrados = pedidos.filter((p) => {
    if (filtroEstado === 'Todos') return true;
    return p.estado === filtroEstado;
  });

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', padding: '30px 20px', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E50914', paddingBottom: '15px', marginBottom: '25px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#E50914', textTransform: 'uppercase', margin: 0 }}>
          GR Pedidos & Facturas
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setMostrarModal(true)}
            style={{ backgroundColor: '#25D366', color: '#000', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ＋ Nuevo Pedido Manual
          </button>
          <button onClick={() => window.location.href = '/admin/dashboard'} style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            Volver al Panel
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#E50914', margin: 0 }}>
                      Orden #{pedido.orderId}
                    </h3>
                    {pedido.origen && (
                      <span style={{ backgroundColor: '#222', color: '#888', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #333' }}>
                        {pedido.origen}
                      </span>
                    )}
                  </div>
                  
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

      {/* MODAL PARA CREAR PEDIDO MANUAL */}
      {mostrarModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000, padding: '20px', overflowY: 'auto'
        }}>
          <div style={{
            backgroundColor: '#141414', border: '1px solid #333', borderRadius: '12px',
            width: '100%', maxWidth: '650px', padding: '25px', maxHeight: '90vh', overflowY: 'auto', color: '#FFF'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#E50914', fontSize: '18px' }}>📝 Registrar Pedido Manual (WhatsApp / Llamada)</h3>
              <button onClick={() => setMostrarModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCrearPedidoManual} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '5px' }}>Nombre del Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Pérez"
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '5px' }}>Teléfono / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 8095551234"
                    value={telefonoCliente}
                    onChange={(e) => setTelefonoCliente(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '5px' }}>Dirección de entrega (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Av. 27 de Febrero, Sto. Dgo."
                  value={direccionCliente}
                  onChange={(e) => setDireccionCliente(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              {/* SELECCIÓN DE PRODUCTOS */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#FFB800', display: 'block', marginBottom: '8px' }}>Seleccionar Productos del Inventario:</label>
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #222', borderRadius: '6px', padding: '8px', backgroundColor: '#0D0D0D', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {productosInventario.map((prod) => (
                    <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141414', padding: '8px', borderRadius: '4px', border: '1px solid #222' }}>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{prod.nombre || prod.titulo}</span>
                        <div style={{ fontSize: '11px', color: '#888' }}>Stock: {prod.stock ?? 0} | RD$ {Number(prod.precio || prod.price || 0).toLocaleString()}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => agregarProductoAlPedido(prod)}
                        style={{ backgroundColor: '#222', color: '#25D366', border: '1px solid #25D366', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        ＋ Agregar
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* RESUMEN DE ÍTEMS SELECCIONADOS */}
              {itemsSeleccionados.length > 0 && (
                <div style={{ backgroundColor: '#1A1A1A', padding: '12px', borderRadius: '6px', border: '1px solid #333' }}>
                  <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '8px' }}>Ítems en este pedido:</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {itemsSeleccionados.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span>{item.nombre || item.titulo} (RD$ {Number(item.precio || item.price || 0)})</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button type="button" onClick={() => cambiarCantidadItem(item.id, -1)} style={{ backgroundColor: '#333', color: '#FFF', border: 'none', width: '22px', height: '22px', borderRadius: '4px', cursor: 'pointer' }}>-</button>
                          <span style={{ fontWeight: 'bold' }}>{item.cantidadSeleccionada}</span>
                          <button type="button" onClick={() => cambiarCantidadItem(item.id, 1)} style={{ backgroundColor: '#333', color: '#FFF', border: 'none', width: '22px', height: '22px', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid #333', marginTop: '10px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#25D366' }}>
                    <span>Total Pedido:</span>
                    <span>RD$ {calcularTotalManual().toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  style={{ backgroundColor: '#222', color: '#AAA', border: '1px solid #444', padding: '10px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoPedido || itemsSeleccionados.length === 0}
                  style={{ backgroundColor: '#25D366', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', opacity: (guardandoPedido || itemsSeleccionados.length === 0) ? 0.5 : 1 }}
                >
                  {guardandoPedido ? 'Guardando...' : '💾 Guardar y Descontar Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
