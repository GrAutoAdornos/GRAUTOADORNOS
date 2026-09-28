import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function ComisionesVendedores() {
  const [vendedores, setVendedores] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState('todos');
  const [filtroEstadoPago, setFiltroEstadoPago] = useState('todos'); // todos, Pendiente, Completado
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(true);

  // Estado para el Modal de Recibo de Pago
  const [pedidoParaRecibo, setPedidoParaRecibo] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);

      // 1. Cargar Vendedores
      const snapVendedores = await getDocs(collection(db, 'vendedores'));
      const listaVendedores = snapVendedores.docs.map(d => ({ id: d.id, ...d.data() }));
      setVendedores(listaVendedores);

      // 2. Cargar Pedidos (colección 'pedidos')
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      let listaPedidos = snapPedidos.docs.map(d => ({ id: d.id, ...d.data() }));

      if (listaPedidos.length === 0) {
        const snapOrdenes = await getDocs(collection(db, 'ordenes'));
        listaPedidos = snapOrdenes.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      setPedidos(listaPedidos);
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Cambiar estado de pago de la comisión en Firebase
  const handleCambiarEstadoComision = async (pedidoId, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), {
        estadoComision: nuevoEstado,
        fechaPagoComision: nuevoEstado === 'Completado' ? new Date().toISOString() : null
      });

      setPedidos(prev =>
        prev.map(p => (p.id === pedidoId ? { ...p, estadoComision: nuevoEstado } : p))
      );
    } catch (error) {
      console.error("Error al actualizar estado de comisión:", error);
      alert("No se pudo actualizar el estado del pago.");
    }
  };

  // Helpers de datos
  const obtenerMontoBase = (pedido) => {
    if (pedido.subtotalProductos !== undefined && Number(pedido.subtotalProductos) > 0) {
      return Number(pedido.subtotalProductos);
    }
    if (Array.isArray(pedido.items) && pedido.items.length > 0) {
      return pedido.items.reduce((sum, item) => {
        const p = Number(item.precio || item.price || 0);
        const q = Number(item.cantidad || item.cantidadSeleccionada || item.quantity || 1);
        return sum + (p * q);
      }, 0);
    }
    const total = Number(pedido.total) || 0;
    const envio = Number(pedido.costoEnvio) || 0;
    return Math.max(0, total - envio);
  };

  const obtenerNombreVendedor = (pedido) => {
    if (pedido.vendedorNombre && pedido.vendedorNombre !== 'Sin Asignar') {
      return pedido.vendedorNombre;
    }
    if (typeof pedido.vendedor === 'string') return pedido.vendedor;
    if (pedido.vendedorId) {
      const v = vendedores.find(vDoc => vDoc.id === pedido.vendedorId);
      if (v) return v.nombre;
    }
    return null;
  };

  // Filtrado de pedidos
  const pedidosFiltrados = pedidos.filter(pedido => {
    const nombreVendedor = obtenerNombreVendedor(pedido);

    // Omitir si no tiene vendedor asignado
    if (!nombreVendedor && !pedido.vendedorId) return false;

    // Solo evaluar pedidos pagados/completados en el cliente si es necesario, o todos los válidos
    const estadoComisionActual = pedido.estadoComision || 'Pendiente';

    // Filtro por Estado de Pago de Comisión
    if (filtroEstadoPago !== 'todos') {
      if (estadoComisionActual !== filtroEstadoPago) return false;
    }

    // Filtro selector por Vendedor
    if (vendedorSeleccionado !== 'todos') {
      const vObj = vendedores.find(v => v.id === vendedorSeleccionado);
      const nombreTarget = vObj ? vObj.nombre : '';

      const coincideId = pedido.vendedorId === vendedorSeleccionado;
      const coincideNombre = nombreVendedor && nombreTarget && 
        nombreVendedor.trim().toLowerCase() === nombreTarget.trim().toLowerCase();

      if (!coincideId && !coincideNombre) return false;
    }

    // Filtro por Fecha
    const fRaw = pedido.fecha || pedido.createdAt || pedido.fechaCreacion;
    if (fRaw) {
      const fechaOrden = fRaw.seconds ? new Date(fRaw.seconds * 1000) : new Date(fRaw);
      if (!isNaN(fechaOrden.getTime())) {
        if (fechaInicio) {
          const inicio = new Date(fechaInicio);
          inicio.setHours(0, 0, 0, 0);
          if (fechaOrden < inicio) return false;
        }
        if (fechaFin) {
          const fin = new Date(fechaFin);
          fin.setHours(23, 59, 59, 999);
          if (fechaOrden > fin) return false;
        }
      }
    }

    return true;
  });

  // Totales generales acumulados
  const totalVendido = pedidosFiltrados.reduce((sum, p) => sum + obtenerMontoBase(p), 0);

  const totalComisiones = pedidosFiltrados.reduce((sum, p) => {
    if (p.montoComisionVendedor !== undefined && Number(p.montoComisionVendedor) > 0) {
      return sum + Number(p.montoComisionVendedor);
    }
    const base = obtenerMontoBase(p);
    const nombreV = obtenerNombreVendedor(p);
    const vObj = vendedores.find(v => v.nombre?.trim().toLowerCase() === nombreV?.trim().toLowerCase());
    const pct = Number(p.vendedorPorcentaje || p.porcentajeComisionVendedor || vObj?.porcentajeDefecto || 5);
    
    return sum + (base * (pct / 100));
  }, 0);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', padding: '20px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* CABECERA */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>💰 Comisiones & Recibos de Vendedores</h2>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/admin/vendedores">
            <button style={{ backgroundColor: '#0070f3', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              ⚙️ Gestionar Vendedores
            </button>
          </Link>
          <Link href="/admin/dashboard">
            <button style={{ backgroundColor: '#222', border: '1px solid #444', color: '#FFF', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>
              Volver al Panel
            </button>
          </Link>
        </div>
      </header>

      {/* FILTROS */}
      <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px' }}>Vendedor:</label>
          <select 
            value={vendedorSeleccionado} 
            onChange={(e) => setVendedorSeleccionado(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
          >
            <option value="todos">Todos los vendedores</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px' }}>Estado Pago Comisión:</label>
          <select 
            value={filtroEstadoPago} 
            onChange={(e) => setFiltroEstadoPago(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
          >
            <option value="todos">Todos los estados</option>
            <option value="Pendiente">⏳ Pago Pendiente</option>
            <option value="Completado">✅ Pago Completado</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px' }}>Fecha Inicio:</label>
          <input 
            type="date" 
            value={fechaInicio} 
            onChange={(e) => setFechaInicio(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px' }}>Fecha Fin:</label>
          <input 
            type="date" 
            value={fechaFin} 
            onChange={(e) => setFechaFin(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
          />
        </div>
      </div>

      {/* TARJETAS RESUMEN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #0070f3' }}>
          <span style={{ color: '#AAA', fontSize: '13px' }}>Base Productos Vendidos</span>
          <h3 style={{ margin: '5px 0 0 0', fontSize: '22px' }}>RD$ {totalVendido.toLocaleString()}</h3>
        </div>
        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #2e7d32' }}>
          <span style={{ color: '#AAA', fontSize: '13px' }}>Total Comisiones (Filtradas)</span>
          <h3 style={{ margin: '5px 0 0 0', fontSize: '22px', color: '#4caf50' }}>RD$ {totalComisiones.toLocaleString()}</h3>
        </div>
      </div>

      {/* TABLA DE DETALLES */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#888', padding: '20px' }}>Cargando información...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#222', color: '#FFF' }}>
              <th style={{ padding: '10px' }}>Orden #</th>
              <th style={{ padding: '10px' }}>Vendedor</th>
              <th style={{ padding: '10px' }}>Cliente</th>
              <th style={{ padding: '10px' }}>Base Productos</th>
              <th style={{ padding: '10px' }}>% Com.</th>
              <th style={{ padding: '10px' }}>Comisión</th>
              <th style={{ padding: '10px' }}>Estado Comisión</th>
              <th style={{ padding: '10px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pedidosFiltrados.map(pedido => {
              const baseMonto = obtenerMontoBase(pedido);
              const nombreV = obtenerNombreVendedor(pedido) || 'N/A';
              const vObj = vendedores.find(v => v.nombre?.trim().toLowerCase() === nombreV?.trim().toLowerCase());
              const pct = Number(pedido.vendedorPorcentaje || pedido.porcentajeComisionVendedor || vObj?.porcentajeDefecto || 5);
              
              const comision = (pedido.montoComisionVendedor !== undefined && Number(pedido.montoComisionVendedor) > 0)
                ? Number(pedido.montoComisionVendedor) 
                : (baseMonto * (pct / 100));

              const nombreC = pedido.clienteNombre || pedido.cliente || 'Cliente General';
              const numOrden = pedido.orderId || pedido.id.slice(-6);
              const estadoComision = pedido.estadoComision || 'Pendiente';

              return (
                <tr key={pedido.id} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '10px' }}>#{numOrden}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{nombreV}</td>
                  <td style={{ padding: '10px', color: '#AAA' }}>{nombreC}</td>
                  <td style={{ padding: '10px' }}>RD$ {baseMonto.toLocaleString()}</td>
                  <td style={{ padding: '10px' }}>{pct}%</td>
                  <td style={{ padding: '10px', color: '#4caf50', fontWeight: 'bold' }}>RD$ {comision.toLocaleString()}</td>
                  
                  {/* ESTADO COMISIÓN */}
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      backgroundColor: estadoComision === 'Completado' ? '#1B382B' : '#3D2A10',
                      color: estadoComision === 'Completado' ? '#25D366' : '#FFB800',
                      border: `1px solid ${estadoComision === 'Completado' ? '#25D366' : '#FFB800'}`,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      {estadoComision === 'Completado' ? '✅ Completado' : '⏳ Pendiente'}
                    </span>
                  </td>

                  {/* ACCIONES */}
                  <td style={{ padding: '10px', display: 'flex', gap: '8px' }}>
                    {estadoComision === 'Pendiente' ? (
                      <button
                        onClick={() => handleCambiarEstadoComision(pedido.id, 'Completado')}
                        style={{ backgroundColor: '#2e7d32', color: '#FFF', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                      >
                        Pagar Comisión
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCambiarEstadoComision(pedido.id, 'Pendiente')}
                        style={{ backgroundColor: '#444', color: '#FFF', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                      >
                        Marcar Pendiente
                      </button>
                    )}

                    <button
                      onClick={() => setPedidoParaRecibo({ ...pedido, baseMonto, comision, pct, nombreV, numOrden })}
                      style={{ backgroundColor: '#0070f3', color: '#FFF', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                    >
                      📄 Recibo
                    </button>
                  </td>
                </tr>
              );
            })}
            {pedidosFiltrados.length === 0 && (
              <tr>
                <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                  No hay comisiones registradas con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* MODAL / COMPROBANTE DE RECIBO DE PAGO */}
      {pedidoParaRecibo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div id="seccion-recibo" style={{
            backgroundColor: '#FFF', color: '#000', borderRadius: '10px',
            width: '100%', maxWidth: '480px', padding: '25px', fontFamily: 'sans-serif'
          }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #E50914', paddingBottom: '10px', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, color: '#E50914', fontSize: '20px', textTransform: 'uppercase' }}>GR AUTO ADORNOS</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#555' }}>RECIBO DE PAGO DE COMISIÓN DE VENTA</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '10px' }}>
              <span><strong>Recibo #:</strong> REC-{pedidoParaRecibo.numOrden}</span>
              <span><strong>Fecha:</strong> {new Date().toLocaleDateString()}</span>
            </div>

            <div style={{ backgroundColor: '#F8F9FA', padding: '12px', borderRadius: '6px', border: '1px solid #EEE', marginBottom: '15px', fontSize: '13px' }}>
              <p style={{ margin: '0 0 5px 0' }}><strong>Vendedor Beneficiario:</strong> {pedidoParaRecibo.nombreV}</p>
              <p style={{ margin: '0 0 5px 0' }}><strong>Orden Referencia:</strong> #{pedidoParaRecibo.numOrden}</p>
              <p style={{ margin: '0 0 5px 0' }}><strong>Cliente:</strong> {pedidoParaRecibo.clienteNombre || pedidoParaRecibo.cliente || 'Cliente General'}</p>
              <p style={{ margin: 0 }}><strong>Estado del Pago:</strong> <span style={{ color: pedidoParaRecibo.estadoComision === 'Completado' ? 'green' : 'orange', fontWeight: 'bold' }}>{pedidoParaRecibo.estadoComision || 'Pendiente'}</span></p>
            </div>

            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', marginBottom: '15px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #DDD', textAlign: 'left' }}>
                  <th style={{ padding: '6px 0' }}>Concepto</th>
                  <th style={{ padding: '6px 0', textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0' }}>Base Venta Productos</td>
                  <td style={{ padding: '6px 0', textAlign: 'right' }}>RD$ {pedidoParaRecibo.baseMonto.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0' }}>Porcentaje Comisión Aplicado</td>
                  <td style={{ padding: '6px 0', textAlign: 'right' }}>{pedidoParaRecibo.pct}%</td>
                </tr>
                <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold', fontSize: '15px' }}>
                  <td style={{ padding: '10px 0', color: '#2e7d32' }}>TOTAL COMISIÓN A PAGAR</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: '#2e7d32' }}>RD$ {pedidoParaRecibo.comision.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ borderTop: '1px dashed #CCC', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', marginTop: '20px', fontSize: '11px', textAlign: 'center' }}>
              <div style={{ width: '45%' }}>
                <div style={{ borderBottom: '1px solid #000', marginBottom: '4px', height: '30px' }}></div>
                <span>Firma Administrador</span>
              </div>
              <div style={{ width: '45%' }}>
                <div style={{ borderBottom: '1px solid #000', marginBottom: '4px', height: '30px' }}></div>
                <span>Firma Conforme Vendedor</span>
              </div>
            </div>

            {/* BOTONES DEL MODAL */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPedidoParaRecibo(null)}
                style={{ backgroundColor: '#666', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                Cerrar
              </button>
              <button
                onClick={() => window.print()}
                style={{ backgroundColor: '#25D366', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
              >
                🖨️ Imprimir / Guardar PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
