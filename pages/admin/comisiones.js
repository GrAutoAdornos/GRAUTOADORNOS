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
  const [modoRecibo, setModoRecibo] = useState(false); // Alterna a vista de recibo imprimible

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

  // Cargar citas o pedidos completados
  const obtenerCitasCompletadas = async () => {
    try {
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      let lista = [];

      snapPedidos.forEach((docSnap) => {
        const data = docSnap.data();
        const estado = data.estadoCita || data.estado;
        
        if (estado === 'Completada' || estado === 'Completado') {
          // Extraer costo de instalación
          let precioInstalacion = Number(
            data.precioInstalacion || 
            data.costoInstalacion || 
            data.instalacion || 
            data.precioManoObra || 
            0
          );

          // Si el precio de instalación no está en un campo numérico directo, buscarlo en detalles
          if (precioInstalacion === 0 && data.detalles && String(data.detalles).includes('Instalación')) {
            const match = String(data.detalles).match(/\d+/);
            if (match) precioInstalacion = Number(match[0]);
          }

          const porcentajeComision = Number(data.porcentajeComision || data.porcentaje) || 0;
          let montoComision = Number(data.montoComision) || 0;

          lista.push({
            id: docSnap.id,
            clienteNombre: data.cliente || data.nombre || data.clienteNombre || 'Cliente General',
            vehiculo: data.vehiculo || data.detalles || data.productos || 'Servicio de Instalación',
            tecnicoId: data.tecnicoId || '',
            tecnicoNombre: data.tecnicoNombre || 'Sin Asignar',
            precioInstalacion: precioInstalacion,
            porcentajeComision: porcentajeComision,
            montoComision: montoComision,
            estadoPagoTecnico: data.estadoPagoTecnico || 'pendiente', // 'pendiente' o 'pagado'
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

  // Cambiar el estado de pago al técnico (Pagado / Pendiente) y guardarlo en Firebase
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

  // Calcular comisión dinámica basándose en el técnico actual
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

  // Filtrado compuesto (Técnico + Estado de Pago)
  const citasFiltradas = citasProcesadas.filter((c) => {
    if (tecnicoFiltro !== 'todos' && c.tecnicoId !== tecnicoFiltro) return false;
    if (filtroPago === 'pendiente' && c.estadoPagoTecnico !== 'pendiente') return false;
    if (filtroPago === 'pagado' && c.estadoPagoTecnico !== 'pagado') return false;
    return true;
  });

  // Totales
  const totalInstalaciones = citasFiltradas.reduce((acc, curr) => acc + (curr.precioInstalacion || 0), 0);
  const totalComisiones = citasFiltradas.reduce((acc, curr) => acc + (curr.montoComision || 0), 0);

  // Citas solo pagadas para el recibo de pago
  const citasSoloPagadas = citasFiltradas.filter((c) => c.estadoPagoTecnico === 'pagado');
  const totalComisionesPagadas = citasSoloPagadas.reduce((acc, curr) => acc + (curr.montoComision || 0), 0);

  const tecSeleccionadoNombre = tecnicos.find((t) => t.id === tecnicoFiltro)?.nombre || 'Técnico General';

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* Estilos para impresión en PDF/Físico */}
      <style jsx global>{`
        @media print {
          body { background-color: #FFF !important; color: #000 !important; }
          header, nav, button, select, .no-print { display: none !important; }
          .area-recibo { color: #000 !important; background-color: #FFF !important; border: 1px solid #000 !important; }
          table { width: 100% !important; color: #000 !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #999 !important; color: #000 !important; padding: 8px !important; }
        }
      `}</style>

      {/* HEADER DE NAVEGACIÓN */}
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

      {/* CONTROLES Y FILTROS */}
      <div className="no-print" style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* Filtro por Técnico */}
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

        {/* Filtro por Estado de Pago */}
        <select 
          value={filtroPago} 
          onChange={(e) => setFiltroPago(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFB800', border: '1px solid #FFB800', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          <option value="todos">Todos los Estados (Pendientes y Pagados)</option>
          <option value="pendiente">🔴 Solo Pendientes de Pago</option>
          <option value="pagado">🟢 Solo Pagados</option>
        </select>

        {/* Botón para alternar a Recibo/Comprobante de Pago */}
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

      {/* VISTA 1: RECIBO DE PAGO COMPROBANTE CON FIRMA */}
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
            A continuación se detallan exclusivamente los trabajos que han sido <strong>PAGADOS</strong> y liquidados:
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

          {/* SECCIÓN DE FIRMAS DE CONFORMIDAD */}
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

        /* VISTA 2: TABLA PRINCIPAL DE GESTIÓN DE COMISIONES */
        <>
          {/* TARJETAS DE RESUMEN */}
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

          {/* TABLA DE DETALLES */}
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
                      <td style={{ padding: '10px' }}>RD$ {(item.precioInstalacion || 0).toLocaleString()}</td>
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
