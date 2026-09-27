import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function ReporteComisiones() {
  const router = useRouter();
  const [citasCompletadas, setCitasCompletadas] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoFiltro, setTecnicoFiltro] = useState('todos');
  const [filtroPago, setFiltroPago] = useState('todos'); // 'todos', 'pendiente', 'pagado'
  const [loading, setLoading] = useState(true);
  const [modoRecibo, setModoRecibo] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    await Promise.all([obtenerTecnicos(), obtenerCitasCompletadas()]);
    setLoading(false);
  };

  // Cargar técnicos desde Firestore
  const obtenerTecnicos = async () => {
    try {
      const snap = await getDocs(collection(db, 'tecnicos'));
      const listaTecnicos = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setTecnicos(listaTecnicos);
    } catch (error) {
      console.error("Error al obtener técnicos:", error);
    }
  };

  // Función para extraer el costo de instalación del pedido o producto
  const extraerPrecioInstalacion = (data) => {
    // 1. Si existe un campo explícito en la raíz de la orden
    if (data.precioInstalacion && Number(data.precioInstalacion) > 0) return Number(data.precioInstalacion);
    if (data.costoInstalacion && Number(data.costoInstalacion) > 0) return Number(data.costoInstalacion);
    if (data.instalacion && Number(data.instalacion) > 0) return Number(data.instalacion);
    if (data.precioManoObra && Number(data.precioManoObra) > 0) return Number(data.precioManoObra);

    // 2. Si viene dentro del array de productos de la orden
    if (Array.isArray(data.productos)) {
      let sumaInstalaciones = 0;
      data.productos.forEach((p) => {
        if (p.precioInstalacion) sumaInstalaciones += Number(p.precioInstalacion);
        else if (p.costoInstalacion) sumaInstalaciones += Number(p.costoInstalacion);
        else if (p.conInstalacion && p.precioInstalacionExtra) sumaInstalaciones += Number(p.precioInstalacionExtra);
      });
      if (sumaInstalaciones > 0) return sumaInstalaciones;
    }

    // 3. Buscar monto de instalación en texto o total si no se especificó un desglose separado
    if (data.detalles || data.productos) {
      const textoDetalle = typeof data.detalles === 'string' ? data.detalles : JSON.stringify(data.productos || '');
      // Busca patrones como "Instalación: RD$1000" o "Instalacion 500"
      const matchMonto = textoDetalle.match(/instalaci[oó]n[^\d]*(\d+)/i);
      if (matchMonto && matchMonto[1]) {
        return Number(matchMonto[1]);
      }
    }

    // 4. Fallback al total del pedido si la orden es exclusivamente un servicio de instalación
    return Number(data.total || data.montoTotal || 0);
  };

  // Cargar citas o pedidos completados
  const obtenerCitasCompletadas = async () => {
    try {
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      let lista = [];

      snapPedidos.forEach((docSnap) => {
        const data = docSnap.data();
        const estado = data.estadoCita || data.estado;
        
        if (estado === 'Completada' || estado === 'Completado') {
          const precioInstalacion = extraerPrecioInstalacion(data);
          const porcentajeComision = Number(data.porcentajeComision || data.porcentaje) || 0;
          let montoComision = Number(data.montoComision) || 0;

          lista.push({
            id: docSnap.id,
            clienteNombre: data.cliente || data.nombre || data.clienteNombre || 'Cliente General',
            vehiculo: data.vehiculo || data.detalles || (Array.isArray(data.productos) ? data.productos.map(p => p.nombre || p.titulo).join(', ') : 'Servicio de Instalación'),
            tecnicoId: data.tecnicoId || '',
            tecnicoNombre: data.tecnicoNombre || 'Sin Asignar',
            precioInstalacion: precioInstalacion,
            porcentajeComision: porcentajeComision,
            montoComision: montoComision,
            estadoPagoTecnico: data.estadoPagoTecnico || 'pendiente',
            fecha: data.fechaInstalacion || data.fechaCita || new Date().toLocaleDateString(),
            ...data
          });
        }
      });

      setCitasCompletadas(lista);
    } catch (error) {
      console.error("Error al obtener instalaciones:", error);
    }
  };

  // Actualizar estado de pago en Firebase
  const cambiarEstadoPago = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === 'pagado' ? 'pendiente' : 'pagado';
    try {
      const refDoc = doc(db, 'pedidos', id);
      await updateDoc(refDoc, { estadoPagoTecnico: nuevoEstado });

      setCitasCompletadas((prev) =>
        prev.map((c) => (c.id === id ? { ...c, estadoPagoTecnico: nuevoEstado } : c))
      );
    } catch (error) {
      console.error("Error al actualizar estado de pago:", error);
      alert("Error al guardar el estado de pago.");
    }
  };

  // Calcular comisión automática con base en el técnico y el costo de instalación
  const citasProcesadas = citasCompletadas.map((item) => {
    const tecObj = tecnicos.find((t) => t.id === item.tecnicoId);
    const porcentaje = item.porcentajeComision > 0 
      ? item.porcentajeComision 
      : (tecObj ? Number(tecObj.porcentajeDefecto || tecObj.porcentaje || 20) : 0);

    const comisionCalculada = (item.precioInstalacion * porcentaje) / 100;

    return {
      ...item,
      porcentajeComision: porcentaje,
      montoComision: item.montoComision > 0 ? item.montoComision : comisionCalculada
    };
  });

  // Filtros
  const citasFiltradas = citasProcesadas.filter((c) => {
    if (tecnicoFiltro !== 'todos' && c.tecnicoId !== tecnicoFiltro) return false;
    if (filtroPago === 'pendiente' && c.estadoPagoTecnico !== 'pendiente') return false;
    if (filtroPago === 'pagado' && c.estadoPagoTecnico !== 'pagado') return false;
    return true;
  });

  // Totales generales
  const totalInstalaciones = citasFiltradas.reduce((acc, curr) => acc + (curr.precioInstalacion || 0), 0);
  const totalComisiones = citasFiltradas.reduce((acc, curr) => acc + (curr.montoComision || 0), 0);

  // Citas solo pagadas para el recibo de firmas
  const citasSoloPagadas = citasFiltradas.filter((c) => c.estadoPagoTecnico === 'pagado');
  const totalComisionesPagadas = citasSoloPagadas.reduce((acc, curr) => acc + (curr.montoComision || 0), 0);

  const tecSeleccionadoNombre = tecnicos.find((t) => t.id === tecnicoFiltro)?.nombre || 'Técnico General';

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      <style jsx global>{`
        @media print {
          body { background-color: #FFF !important; color: #000 !important; }
          header, nav, button, select, .no-print { display: none !important; }
          .area-recibo { color: #000 !important; background-color: #FFF !important; border: 1px solid #000 !important; }
          table { width: 100% !important; color: #000 !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #999 !important; color: #000 !important; padding: 8px !important; }
        }
      `}</style>

      {/* HEADER */}
      <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link href="/admin/citas">
            <button style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              ← Volver a Citas
            </button>
          </Link>
          <h2 style={{ margin: 0, fontSize: '20px' }}>👷‍♂️ Reporte & Pago de Comisiones</h2>
        </div>

        <Link href="/admin/dashboard">
          <button style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
            Volver al Panel
          </button>
        </Link>
      </header>

      {/* CONTROLES */}
      <div className="no-print" style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        
        <select 
          value={tecnicoFiltro} 
          onChange={(e) => setTecnicoFiltro(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444', outline: 'none', cursor: 'pointer' }}
        >
          <option value="todos">Todos los Técnicos ({tecnicos.length})</option>
          {tecnicos.map((tec) => (
            <option key={tec.id} value={tec.id}>
              {tec.nombre} ({tec.porcentajeDefecto || tec.porcentaje || 20}%)
            </option>
          ))}
        </select>

        <select 
          value={filtroPago} 
          onChange={(e) => setFiltroPago(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFB800', border: '1px solid #FFB800', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          <option value="todos">Todos los Estados (Pendientes y Pagados)</option>
          <option value="pendiente">🔴 Solo Pendientes de Pago</option>
          <option value="pagado">🟢 Solo Pagados</option>
        </select>

        <button 
          onClick={() => setModoRecibo(!modoRecibo)}
          style={{ backgroundColor: modoRecibo ? '#222' : '#25D366', color: modoRecibo ? '#FFF' : '#000', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {modoRecibo ? '📋 Volver a Tabla General' : '🧾 Ver Recibo de Pago (Firmas)'}
        </button>

        <button 
          onClick={() => window.print()}
          style={{ backgroundColor: '#E50914', color: '#FFF', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          🖨️ Imprimir / Guardar PDF
        </button>
      </div>

      {/* VISTA RECIBO CON FIRMAS */}
      {modoRecibo ? (
        <div className="area-recibo" style={{ backgroundColor: '#141414', padding: '30px', borderRadius: '10px', border: '1px solid #333', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #E50914', paddingBottom: '15px', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '22px' }}>GR AUTO ADORNOS</h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#AAA' }}>COMPROBANTE DE PAGO DE COMISIONES A TÉCNICO</p>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#FFB800' }}>
              Técnico: <strong>{tecSeleccionadoNombre}</strong> | Fecha: {new Date().toLocaleDateString()}
            </p>
          </div>

          <p style={{ fontSize: '13px', color: '#CCC', marginBottom: '15px' }}>
            A continuación se detallan exclusivamente los trabajos que han sido <strong>PAGADOS</strong>:
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr style={{ backgroundColor: '#222', color: '#FFF', textAlign: 'left' }}>
                <th style={{ padding: '8px', fontSize: '12px' }}>Fecha</th>
                <th style={{ padding: '8px', fontSize: '12px' }}>Cliente / Servicio</th>
                <th style={{ padding: '8px', fontSize: '12px' }}>Precio Inst.</th>
                <th style={{ padding: '8px', fontSize: '12px' }}>%</th>
                <th style={{ padding: '8px', fontSize: '12px' }}>Comisión Pagada</th>
              </tr>
            </thead>
            <tbody>
              {citasSoloPagadas.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #333', fontSize: '13px' }}>
                  <td style={{ padding: '8px' }}>{item.fecha}</td>
                  <td style={{ padding: '8px' }}>{item.clienteNombre} - {item.vehiculo}</td>
                  <td style={{ padding: '8px' }}>RD$ {(item.precioInstalacion || 0).toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>{item.porcentajeComision}%</td>
                  <td style={{ padding: '8px', fontWeight: 'bold', color: '#25D366' }}>
                    RD$ {(item.montoComision || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
              {citasSoloPagadas.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                    No hay servicios marcados como "Pagado" para este técnico.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0D0D0D', padding: '15px', borderRadius: '8px', border: '1px solid #333', marginBottom: '40px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>TOTAL LIQUIDADO / ENTREGADO:</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#25D366' }}>RD$ {totalComisionesPagadas.toLocaleString()}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '60px', textAlign: 'center' }}>
            <div style={{ width: '220px', borderTop: '1px solid #FFF', paddingTop: '8px' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>Firma del Técnico</p>
              <p style={{ margin: '3px 0 0 0', fontSize: '10px', color: '#AAA' }}>{tecSeleccionadoNombre}</p>
            </div>
            <div style={{ width: '220px', borderTop: '1px solid #FFF', paddingTop: '8px' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>Administración / Recibido</p>
              <p style={{ margin: '3px 0 0 0', fontSize: '10px', color: '#AAA' }}>GR Auto Adornos</p>
            </div>
          </div>
        </div>
      ) : (

        /* TABLA GENERAL */
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
            <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
              <p style={{ color: '#AAA', margin: 0, fontSize: '13px' }}>Trabajos Registrados</p>
              <h3 style={{ margin: '5px 0 0 0', color: '#FFF' }}>{citasFiltradas.length}</h3>
            </div>

            <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
              <p style={{ color: '#AAA', margin: 0, fontSize: '13px' }}>Total Precio Instalación</p>
              <h3 style={{ margin: '5px 0 0 0', color: '#25D366' }}>RD$ {totalInstalaciones.toLocaleString()}</h3>
            </div>

            <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', border: '1px solid #E50914' }}>
              <p style={{ color: '#AAA', margin: 0, fontSize: '13px' }}>Total Comisiones Calculadas</p>
              <h3 style={{ margin: '5px 0 0 0', color: '#E50914' }}>RD$ {totalComisiones.toLocaleString()}</h3>
            </div>
          </div>

          {loading ? (
            <p style={{ color: '#888', textAlign: 'center', padding: '30px' }}>Cargando reporte de comisiones...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#222', color: '#FFF', borderBottom: '2px solid #444' }}>
                  <th style={{ padding: '10px' }}>Cliente / Vehículo</th>
                  <th style={{ padding: '10px' }}>Técnico</th>
                  <th style={{ padding: '10px' }}>Precio Instalación</th>
                  <th style={{ padding: '10px' }}>% Com.</th>
                  <th style={{ padding: '10px' }}>Comisión a Pagar</th>
                  <th style={{ padding: '10px' }} className="no-print">Estado de Pago</th>
                </tr>
              </thead>
              <tbody>
                {citasFiltradas.map((item) => {
                  const estaPagado = item.estadoPagoTecnico === 'pagado';

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '10px' }}>{item.clienteNombre} - {item.vehiculo}</td>
                      <td style={{ padding: '10px' }}>{item.tecnicoNombre}</td>
                      <td style={{ padding: '10px' }}>
                        RD$ {(item.precioInstalacion || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px' }}>{item.porcentajeComision || 0}%</td>
                      <td style={{ padding: '10px', fontWeight: 'bold', color: '#25D366' }}>
                        RD$ {(item.montoComision || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px' }} className="no-print">
                        <button
                          onClick={() => cambiarEstadoPago(item.id, item.estadoPagoTecnico)}
                          style={{
                            backgroundColor: estaPagado ? '#1C3829' : '#381C1C',
                            color: estaPagado ? '#25D366' : '#FF4D4D',
                            border: estaPagado ? '1px solid #25D366' : '1px solid #FF4D4D',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          {estaPagado ? '✅ PAGADO' : '🔴 PENDIENTE'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {citasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                      No hay registros de instalaciones para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </>
      )}

    </div>
  );
}
