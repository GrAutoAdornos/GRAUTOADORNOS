import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import Link from 'next/link';

export default function ComisionesVendedores() {
  const [vendedores, setVendedores] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState('todos'); // Opción 'todos' por defecto
  const [estadoComisionFiltro, setEstadoComisionFiltro] = useState('todos'); // Pendiente, Completado, todos
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(true);

  // Estado para el Recibo Consolidado
  const [reciboConsolidado, setReciboConsolidado] = useState(null);

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

  // Helpers de cálculo de monto
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

  // FILTRADO DE PEDIDOS (CON CONDICIONAL ESTRICTA DE PAGO Y ENTREGA)
  const pedidosFiltrados = pedidos.filter(pedido => {
    // 1. VALIDACIÓN OBLIGATORIA: Pedido Completado Y Pago Confirmado
    const estadoOrden = String(pedido.estado || pedido.estadoPedido || '').toLowerCase().trim();
    const estadoPagoCliente = String(pedido.estadoPago || pedido.pagoEstado || '').toLowerCase().trim();

    const estaCompletado = estadoOrden === 'completado' || estadoOrden === 'entregado' || estadoOrden === 'finalizado';
    const estaPagado = estadoPagoCliente === 'pagado' || estadoPagoCliente === 'completado' || estadoPagoCliente === 'confirmado';

    // Si la orden o el pago están pendientes, SE IGNORA POR COMPLETO (No sube comisión)
    if (!estaCompletado || !estaPagado) {
      return false;
    }

    // 2. Validar si tiene vendedor asignado
    const nombreVendedor = obtenerNombreVendedor(pedido);
    if (!nombreVendedor && !pedido.vendedorId) return false;

    // 3. Filtro Selector por Vendedor (Acepta 'todos')
    if (vendedorSeleccionado !== 'todos') {
      const vObj = vendedores.find(v => v.id === vendedorSeleccionado);
      const nombreTarget = vObj ? vObj.nombre : '';

      const coincideId = pedido.vendedorId === vendedorSeleccionado;
      const coincideNombre = nombreVendedor && nombreTarget && 
        nombreVendedor.trim().toLowerCase() === nombreTarget.trim().toLowerCase();

      if (!coincideId && !coincideNombre) return false;
    }

    // 4. Filtro Estado de Liquidación de la Comisión
    const estadoComision = pedido.estadoComision || 'Pendiente';
    if (estadoComisionFiltro !== 'todos') {
      if (estadoComisionFiltro === 'Pendiente' && estadoComision === 'Completado') return false;
      if (estadoComisionFiltro === 'Completado' && estadoComision !== 'Completado') return false;
    }

    // 5. Filtro por Fechas
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

  // TOTALES GENERALES DEL FILTRO
  const totalVendidoPeriodo = pedidosFiltrados.reduce((sum, p) => sum + obtenerMontoBase(p), 0);

  const totalComisionPeriodo = pedidosFiltrados.reduce((sum, p) => {
    if (p.montoComisionVendedor !== undefined && Number(p.montoComisionVendedor) > 0) {
      return sum + Number(p.montoComisionVendedor);
    }
    const base = obtenerMontoBase(p);
    const nombreV = obtenerNombreVendedor(p);
    const vObj = vendedores.find(v => v.nombre?.trim().toLowerCase() === nombreV?.trim().toLowerCase());
    const pct = Number(p.vendedorPorcentaje || p.porcentajeComisionVendedor || vObj?.porcentajeDefecto || 5);
    return sum + (base * (pct / 100));
  }, 0);

  // CAMBIAR/REVERTIR ESTADO DE COMISIÓN
  const handleToggleEstadoComision = async (pedidoId, estadoActual) => {
    const nuevoEstado = estadoActual === 'Completado' ? 'Pendiente' : 'Completado';
    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), {
        estadoComision: nuevoEstado,
        fechaPagoComision: nuevoEstado === 'Completado' ? new Date().toISOString() : null
      });

      setPedidos(prev =>
        prev.map(p => (p.id === pedidoId ? { ...p, estadoComision: nuevoEstado } : p))
      );
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      alert("No se pudo cambiar el estado de la comisión.");
    }
  };

  // ELIMINAR REGISTRO DE PRUEBA
  const handleEliminarPedido = async (pedidoId) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este registro de prueba?")) return;

    try {
      await deleteDoc(doc(db, 'pedidos', pedidoId));
      setPedidos(prev => prev.filter(p => p.id !== pedidoId));
      alert("Registro eliminado correctamente.");
    } catch (error) {
      console.error("Error al eliminar pedido:", error);
      alert("Error al eliminar el documento.");
    }
  };

  // MARCAR TODA LA LIQUIDACIÓN FILTRADA COMO PAGADA
  const handlePagarLiquidacion = async () => {
    if (pedidosFiltrados.length === 0) return alert("No hay comisiones en pantalla para liquidar.");

    if (!confirm(`¿Confirmas el pago de RD$ ${totalComisionPeriodo.toLocaleString()} correspondiente a ${pedidosFiltrados.length} registro(s)?`)) {
      return;
    }

    try {
      const batch = writeBatch(db);
      const fechaPagoStr = new Date().toISOString();

      pedidosFiltrados.forEach(p => {
        const refDoc = doc(db, 'pedidos', p.id);
        batch.update(refDoc, {
          estadoComision: 'Completado',
          fechaPagoComision: fechaPagoStr
        });
      });

      await batch.commit();

      setPedidos(prev =>
        prev.map(p => {
          if (pedidosFiltrados.some(pf => pf.id === p.id)) {
            return { ...p, estadoComision: 'Completado', fechaPagoComision: fechaPagoStr };
          }
          return p;
        })
      );

      alert("Liquidación completada exitosamente.");
    } catch (error) {
      console.error("Error al liquidar comisiones:", error);
      alert("Hubo un error al procesar la liquidación.");
    }
  };

  // PREPARAR RECIBO CONSOLIDADO
  const handleGenerarReciboConsolidado = () => {
    let nombreVendedor = 'Todos los Vendedores';
    let cedulaVendedor = 'N/A';

    if (vendedorSeleccionado !== 'todos') {
      const vObj = vendedores.find(v => v.id === vendedorSeleccionado);
      if (vObj) {
        nombreVendedor = vObj.nombre;
        cedulaVendedor = vObj.cedula || vObj.telefono || 'N/A';
      }
    }

    setReciboConsolidado({
      vendedorNombre: nombreVendedor,
      vendedorCedula: cedulaVendedor,
      fechaInicio: fechaInicio || 'Inicio de Registro',
      fechaFin: fechaFin || 'Fecha Actual',
      pedidos: pedidosFiltrados,
      totalVenta: totalVendidoPeriodo,
      totalPagar: totalComisionPeriodo
    });
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', padding: '20px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* CABECERA */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Liquidación Quincenal / Mensual de Vendedores</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#888' }}>
            Filtra por período y liquida todas las ventas completadas del vendedor.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/admin/vendedores">
            <button style={{ backgroundColor: '#0070f3', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Gestionar Vendedores
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
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444', minWidth: '180px' }}
          >
            <option value="todos">Todos los vendedores</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px' }}>Estado Liquidación:</label>
          <select 
            value={estadoComisionFiltro} 
            onChange={(e) => setEstadoComisionFiltro(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
          >
            <option value="todos">Todas las ventas</option>
            <option value="Pendiente">Pendientes de Pago</option>
            <option value="Completado">Liquidadas</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px' }}>Desde (Inicio Quincena/Mes):</label>
          <input 
            type="date" 
            value={fechaInicio} 
            onChange={(e) => setFechaInicio(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px' }}>Hasta (Fin Quincena/Mes):</label>
          <input 
            type="date" 
            value={fechaFin} 
            onChange={(e) => setFechaFin(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
          />
        </div>
      </div>

      {/* TARJETAS RESUMEN DE LIQUIDACIÓN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #0070f3' }}>
          <span style={{ color: '#AAA', fontSize: '13px' }}>Ventas del Período</span>
          <h3 style={{ margin: '5px 0 0 0', fontSize: '22px' }}>RD$ {totalVendidoPeriodo.toLocaleString()}</h3>
        </div>

        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #2e7d32' }}>
          <span style={{ color: '#AAA', fontSize: '13px' }}>Total Comisión a Liquidar</span>
          <h3 style={{ margin: '5px 0 0 0', fontSize: '22px', color: '#4caf50' }}>RD$ {totalComisionPeriodo.toLocaleString()}</h3>
        </div>

        {/* ACCIONES DE LIQUIDACIÓN */}
        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
          <button
            onClick={handlePagarLiquidacion}
            disabled={pedidosFiltrados.length === 0}
            style={{ backgroundColor: pedidosFiltrados.length > 0 ? '#2e7d32' : '#444', color: '#FFF', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            Liquidar Todo lo Filtrado
          </button>

          <button
            onClick={handleGenerarReciboConsolidado}
            disabled={pedidosFiltrados.length === 0}
            style={{ backgroundColor: pedidosFiltrados.length > 0 ? '#0070f3' : '#444', color: '#FFF', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            Generar Recibo de Pago Global
          </button>
        </div>
      </div>

      {/* TABLA DE DETALLE */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#888', padding: '20px' }}>Cargando información...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#222', color: '#FFF' }}>
              <th style={{ padding: '10px' }}>Orden #</th>
              <th style={{ padding: '10px' }}>Vendedor</th>
              <th style={{ padding: '10px' }}>Cliente</th>
              <th style={{ padding: '10px' }}>Monto Venta</th>
              <th style={{ padding: '10px' }}>% Com.</th>
              <th style={{ padding: '10px' }}>Monto Comisión</th>
              <th style={{ padding: '10px' }}>Estado Comisión (Haz clic para cambiar)</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>Acciones</th>
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
                  
                  {/* ESTADO COMISIÓN INTERACTIVO */}
                  <td style={{ padding: '10px' }}>
                    <button
                      onClick={() => handleToggleEstadoComision(pedido.id, estadoComision)}
                      title="Haz clic para alternar entre Liquidado y Pendiente"
                      style={{
                        backgroundColor: estadoComision === 'Completado' ? '#1B382B' : '#3D2A10',
                        color: estadoComision === 'Completado' ? '#25D366' : '#FFB800',
                        border: `1px solid ${estadoComision === 'Completado' ? '#25D366' : '#FFB800'}`,
                        padding: '5px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      {estadoComision === 'Completado' ? 'Liquidado' : 'Pendiente'}
                    </button>
                  </td>

                  {/* ACCIÓN ELIMINAR REGISTRO */}
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleEliminarPedido(pedido.id)}
                      title="Eliminar este registro de prueba"
                      style={{
                        backgroundColor: '#331111',
                        color: '#FF4D4D',
                        border: '1px solid #FF4D4D',
                        padding: '5px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
            {pedidosFiltrados.length === 0 && (
              <tr>
                <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                  No hay ventas cobradas y completadas registradas para el filtro seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* MODAL / RECIBO GLOBAL CONSOLIDADO DEL PERÍODO */}
      {reciboConsolidado && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFF', color: '#000', borderRadius: '10px',
            width: '100%', maxWidth: '600px', padding: '25px', fontFamily: 'sans-serif',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            
            <div style={{ textAlign: 'center', borderBottom: '2px solid #E50914', paddingBottom: '10px', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, color: '#E50914', fontSize: '20px', textTransform: 'uppercase' }}>GR AUTO ADORNOS</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#555', fontWeight: 'bold' }}>
                COMPROBANTE GENERAL DE PAGO DE COMISIONES
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '10px' }}>
              <span><strong>Fecha Emisión:</strong> {new Date().toLocaleDateString()}</span>
              <span><strong>Rango:</strong> {reciboConsolidado.fechaInicio} al {reciboConsolidado.fechaFin}</span>
            </div>

            <div style={{ backgroundColor: '#F8F9FA', padding: '12px', borderRadius: '6px', border: '1px solid #EEE', marginBottom: '15px', fontSize: '13px' }}>
              <p style={{ margin: '0 0 4px 0' }}><strong>Vendedor(es):</strong> {reciboConsolidado.vendedorNombre}</p>
              <p style={{ margin: 0 }}><strong>Cédula/Contacto:</strong> {reciboConsolidado.vendedorCedula}</p>
            </div>

            {/* TABLA RESUMEN DE VENTAS DEL RECIBO */}
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '15px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F0F0F0', textAlign: 'left', borderBottom: '1px solid #CCC' }}>
                  <th style={{ padding: '6px' }}>Orden #</th>
                  <th style={{ padding: '6px' }}>Vendedor</th>
                  <th style={{ padding: '6px' }}>Monto Venta</th>
                  <th style={{ padding: '6px' }}>%</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>Comisión</th>
                </tr>
              </thead>
              <tbody>
                {reciboConsolidado.pedidos.map(p => {
                  const baseMonto = obtenerMontoBase(p);
                  const nombreV = obtenerNombreVendedor(p) || 'N/A';
                  const vObj = vendedores.find(v => v.nombre?.trim().toLowerCase() === nombreV?.trim().toLowerCase());
                  const pct = Number(p.vendedorPorcentaje || p.porcentajeComisionVendedor || vObj?.porcentajeDefecto || 5);
                  const comision = (p.montoComisionVendedor !== undefined && Number(p.montoComisionVendedor) > 0)
                    ? Number(p.montoComisionVendedor) 
                    : (baseMonto * (pct / 100));

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #EEE' }}>
                      <td style={{ padding: '6px' }}>#{p.orderId || p.id.slice(-6)}</td>
                      <td style={{ padding: '6px' }}>{nombreV}</td>
                      <td style={{ padding: '6px' }}>RD$ {baseMonto.toLocaleString()}</td>
                      <td style={{ padding: '6px' }}>{pct}%</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>RD$ {comision.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* RESUMEN DE TOTALES */}
            <div style={{ backgroundColor: '#E8F5E9', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontWeight: 'bold', color: '#2E7D32', fontSize: '14px' }}>TOTAL DESEMBOLSO COMISIONES:</span>
              <span style={{ fontWeight: 'bold', color: '#2E7D32', fontSize: '18px' }}>RD$ {reciboConsolidado.totalPagar.toLocaleString()}</span>
            </div>

            {/* FIRMAS */}
            <div style={{ borderTop: '1px dashed #CCC', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', marginTop: '25px', fontSize: '11px', textAlign: 'center' }}>
              <div style={{ width: '45%' }}>
                <div style={{ borderBottom: '1px solid #000', marginBottom: '4px', height: '35px' }}></div>
                <span>Firma / Autorizado por</span>
              </div>
              <div style={{ width: '45%' }}>
                <div style={{ borderBottom: '1px solid #000', marginBottom: '4px', height: '35px' }}></div>
                <span>Recibido Conforme</span>
              </div>
            </div>

            {/* BOTONES */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setReciboConsolidado(null)}
                style={{ backgroundColor: '#666', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                Cerrar
              </button>
              <button
                onClick={() => window.print()}
                style={{ backgroundColor: '#25D366', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
              >
                Imprimir / Guardar PDF
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
