import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function ReporteComisiones() {
  const router = useRouter();
  const [citasCompletadas, setCitasCompletadas] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoFiltro, setTecnicoFiltro] = useState('todos');
  const [filtroPago, setFiltroPago] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [modoRecibo, setModoRecibo] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const formatearFecha = (fecha) => {
    if (!fecha) return new Date().toLocaleDateString();
    if (fecha?.toDate && typeof fecha.toDate === 'function') {
      return fecha.toDate().toLocaleDateString();
    }
    return String(fecha);
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const snapProductos = await getDocs(collection(db, 'productos'));
      const mapaProductos = {};
      snapProductos.forEach((docSnap) => {
        const prodData = docSnap.data() || {};
        const nombreProd = String(prodData.nombre || docSnap.id).toLowerCase().trim();
        mapaProductos[nombreProd] = Number(prodData.precioInstalacion || prodData.instalacion || prodData.costoInstalacion || 0);
      });

      const listaTecnicos = await obtenerTecnicos();
      await obtenerCitasCompletadas(mapaProductos, listaTecnicos);
    } catch (error) {
      console.error("Error al cargar la información:", error);
    } finally {
      setLoading(false);
    }
  };

  const obtenerTecnicos = async () => {
    try {
      const snap = await getDocs(collection(db, 'tecnicos'));
      const lista = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setTecnicos(lista);
      return lista;
    } catch (error) {
      console.error("Error al obtener técnicos:", error);
      return [];
    }
  };

  // Extraer un valor numérico seguro desde cualquier variable
  const limpiarNumero = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const num = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const obtenerCostoInstalacionPuro = (data, mapaProductos) => {
    // 1. Verificar si la cita tiene mano de obra o precio de instalación explícito
    const manoObra = limpiarNumero(data.precioManoObra || data.precioInstalacion || data.costoInstalacion || data.montoInstalacion);
    if (manoObra > 0) return manoObra;

    // 2. Verificar en el desglose de productos
    let tarifaInstalacion = 0;
    if (Array.isArray(data.productos) && data.productos.length > 0) {
      data.productos.forEach((p) => {
        const montoInst = limpiarNumero(p.precioInstalacion || p.instalacion || p.costoInstalacion || p.instalacionExtra);
        if (montoInst > 0) {
          tarifaInstalacion += montoInst;
        } else {
          const nombre = String(p.nombre || p.titulo || '').toLowerCase().trim();
          if (mapaProductos[nombre]) {
            tarifaInstalacion += mapaProductos[nombre];
          }
        }
      });
      if (tarifaInstalacion > 0) return tarifaInstalacion;
    }

    // 3. Si no hay tarifa separada de instalación, se toma el total del servicio/pedido
    return limpiarNumero(data.total || data.monto || data.precioTotal || 1600);
  };

  const obtenerCitasCompletadas = async (mapaProductos, listaTecnicos) => {
    try {
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      let lista = [];

      snapPedidos.forEach((docSnap) => {
        const data = docSnap.data() || {};
        
        // Estado de cita en minúsculas
        const estadoCita = String(data.estadoCita || data.estado || '').toLowerCase().trim();
        const esCompletada = estadoCita === 'completada' || estadoCita === 'completado';
        
        const tieneTecnico = Boolean(data.tecnicoId || data.tecnicoNombre);
        const esCitaValida = Boolean(data.esCita || data.fechaCita || data.fechaInstalacion || tieneTecnico);

        if (esCompletada && esCitaValida) {
          const precioInstalacion = obtenerCostoInstalacionPuro(data, mapaProductos);
          const clienteNombre = data.cliente || data.clienteNombre || data.nombre || 'Cliente General';
          
          let tecEncontrado = listaTecnicos.find(t => t.id === data.tecnicoId);
          if (!tecEncontrado && data.tecnicoNombre) {
            tecEncontrado = listaTecnicos.find(t => 
              String(t.nombre || '').toLowerCase().trim() === String(data.tecnicoNombre).toLowerCase().trim()
            );
          }

          const tecnicoNombre = tecEncontrado ? tecEncontrado.nombre : (data.tecnicoNombre || 'Sin Asignar');
          const tecnicoId = tecEncontrado ? tecEncontrado.id : (data.tecnicoId || '');

          // Extraer Porcentaje
          let porcentajeComision = limpiarNumero(data.porcentajeComision || data.porcentaje || data.tecnicoPorcentaje);
          if (porcentajeComision === 0 && tecEncontrado) {
            porcentajeComision = limpiarNumero(tecEncontrado.porcentajeDefecto || tecEncontrado.porcentaje || 50);
          }
          if (porcentajeComision === 0) {
            porcentajeComision = 50; // Porcentaje base si no está definido
          }

          // CALCULAR COMISIÓN DE FORMA DIRECTA Y LIMPIA
          let montoComision = limpiarNumero(data.montoComision);
          if (montoComision === 0) {
            montoComision = (precioInstalacion * porcentajeComision) / 100;
          }

          let vehiculoTexto = data.detalles || data.vehiculo;
          if (!vehiculoTexto && Array.isArray(data.productos)) {
            vehiculoTexto = data.productos
              .map(p => `${p.nombre || p.titulo || 'Producto'} (x${p.cantidad || 1})`)
              .join(', ');
          }

          lista.push({
            id: docSnap.id,
            clienteNombre: clienteNombre,
            vehiculo: vehiculoTexto || 'Servicio de Instalación',
            tecnicoId: tecnicoId,
            tecnicoNombre: tecnicoNombre,
            precioInstalacion: precioInstalacion,
            porcentajeComision: porcentajeComision,
            montoComision: montoComision,
            estadoPagoTecnico: String(data.estadoPagoTecnico || 'pendiente').toLowerCase(),
            fecha: formatearFecha(data.fechaInstalacion || data.fechaCita || data.fecha),
            ...data
          });
        }
      });

      setCitasCompletadas(lista);
    } catch (error) {
      console.error("Error al obtener instalaciones completadas:", error);
    }
  };

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

  const citasFiltradas = citasCompletadas.filter((c) => {
    if (tecnicoFiltro !== 'todos' && c.tecnicoId !== tecnicoFiltro) return false;
    if (filtroPago === 'pendiente' && c.estadoPagoTecnico !== 'pendiente') return false;
    if (filtroPago === 'pagado' && c.estadoPagoTecnico !== 'pagado') return false;
    return true;
  });

  const totalInstalaciones = citasFiltradas.reduce((acc, curr) => acc + (curr.precioInstalacion || 0), 0);
  const totalComisiones = citasFiltradas.reduce((acc, curr) => acc + (curr.montoComision || 0), 0);

  const citasSoloPagadas = citasFiltradas.filter((c) => c.estadoPagoTecnico === 'pagado');
  const totalComisionesPagadas = citasSoloPagadas.reduce((acc, curr) => acc + (curr.montoComision || 0), 0);

  const tecSeleccionadoNombre = tecnicos.find((t) => t.id === tecnicoFiltro)?.nombre || (citasSoloPagadas[0]?.tecnicoNombre || 'Técnico General');

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      <style jsx global>{`
        @media print {
          body { background-color: #FFF !important; color: #000 !important; }
          header, nav, button, select, .no-print { display: none !important; }
          .area-recibo { 
            color: #000 !important; 
            background-color: #FFF !important; 
            border: 2px solid #000 !important; 
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 20px !important;
          }
          .area-recibo table { width: 100% !important; color: #000 !important; border-collapse: collapse !important; }
          .area-recibo th { background-color: #F0F0F0 !important; color: #000 !important; border: 1px solid #000 !important; }
          .area-recibo td { border: 1px solid #000 !important; color: #000 !important; }
          .area-recibo .resumen-box { border: 1px solid #000 !important; background-color: #FFF !important; color: #000 !important; }
          .area-recibo .texto-impresion { color: #000 !important; }
        }
      `}</style>

      {/* HEADER DE NAVEGACIÓN */}
      <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link href="/admin/citas">
            <button style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
               Volver a Citas
            </button>
          </Link>
          <h2 style={{ margin: 0, fontSize: '20px' }}> Reporte & Pago de Comisiones</h2>
        </div>

        <Link href="/admin/dashboard">
          <button style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
            Volver al Panel
          </button>
        </Link>
      </header>

      {/* BARRA DE CONTROLES */}
      <div className="no-print" style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select 
          value={tecnicoFiltro} 
          onChange={(e) => setTecnicoFiltro(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444', outline: 'none', cursor: 'pointer' }}
        >
          <option value="todos">Todos los Técnicos ({tecnicos.length})</option>
          {tecnicos.map((tec) => (
            <option key={tec.id} value={tec.id}>
              {tec.nombre} ({tec.porcentajeDefecto || tec.porcentaje || 50}%)
            </option>
          ))}
        </select>

        <select 
          value={filtroPago} 
          onChange={(e) => setFiltroPago(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFB800', border: '1px solid #FFB800', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          <option value="todos">Todos los Estados (Pendientes y Pagados)</option>
          <option value="pendiente"> Solo Pendientes de Pago</option>
          <option value="pagado"> Solo Pagados</option>
        </select>

        <button 
          onClick={() => setModoRecibo(!modoRecibo)}
          style={{ backgroundColor: modoRecibo ? '#222' : '#25D366', color: modoRecibo ? '#FFF' : '#000', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {modoRecibo ? ' Volver a Tabla General' : ' Ver Recibo de Pago'}
        </button>

        <button 
          onClick={() => window.print()}
          style={{ backgroundColor: '#E50914', color: '#FFF', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
           Imprimir Recibo
        </button>
      </div>

      {modoRecibo ? (
        <div className="area-recibo" style={{ backgroundColor: '#141414', padding: '35px', borderRadius: '10px', border: '1px solid #333', maxWidth: '850px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E50914', paddingBottom: '15px', marginBottom: '20px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }} className="texto-impresion">GR AUTO ADORNOS</h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#AAA' }} className="texto-impresion">Servicios de Instalación & Accesorios Automotrices</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#E50914' }}>COMPROBANTE DE PAGO</h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#CCC' }} className="texto-impresion">Fecha: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div style={{ backgroundColor: '#1A1A1A', padding: '12px 18px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #333' }} className="resumen-box">
            <p style={{ margin: 0, fontSize: '14px' }} className="texto-impresion">
              Técnico / Instalador: <strong>{tecSeleccionadoNombre}</strong>
            </p>
          </div>

          <p style={{ fontSize: '13px', color: '#CCC', marginBottom: '12px' }} className="texto-impresion">
            Detalle de instalaciones y servicios <strong>PAGADOS Y LIQUIDADOS</strong>:
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
            <thead>
              <tr style={{ backgroundColor: '#222', color: '#FFF', textAlign: 'left' }}>
                <th style={{ padding: '10px', fontSize: '12px' }}>Fecha</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>Cliente / Trabajo Realizado</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>Precio Instalación</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>% Com.</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>Comisión Pagada</th>
              </tr>
            </thead>
            <tbody>
              {citasSoloPagadas.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #333', fontSize: '13px' }}>
                  <td style={{ padding: '10px' }} className="texto-impresion">{item.fecha}</td>
                  <td style={{ padding: '10px' }} className="texto-impresion">{item.clienteNombre} - {item.vehiculo}</td>
                  <td style={{ padding: '10px' }} className="texto-impresion">RD$ {(item.precioInstalacion || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px' }} className="texto-impresion">{item.porcentajeComision}%</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#25D366' }} className="texto-impresion">
                    RD$ {(item.montoComision || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
              {citasSoloPagadas.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                    No hay trabajos marcados como "PAGADO" para este técnico.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0D0D0D', padding: '15px 20px', borderRadius: '8px', border: '1px solid #333', marginBottom: '50px' }} className="resumen-box">
            <span style={{ fontSize: '15px', fontWeight: 'bold' }} className="texto-impresion">TOTAL ENTREGADO / LIQUIDADO:</span>
            <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#25D366' }} className="texto-impresion">RD$ {totalComisionesPagadas.toLocaleString()}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '70px', padding: '0 30px' }}>
            <div style={{ width: '220px', borderTop: '1px solid #888', paddingTop: '8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }} className="texto-impresion">Firma del Técnico</p>
              <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#888' }} className="texto-impresion">{tecSeleccionadoNombre}</p>
            </div>
            <div style={{ width: '220px', borderTop: '1px solid #888', paddingTop: '8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }} className="texto-impresion">Recibido Conforme Admin</p>
              <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#888' }} className="texto-impresion">GR Auto Adornos</p>
            </div>
          </div>
        </div>
      ) : (
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
            <p style={{ color: '#888', textAlign: 'center', padding: '30px' }}>Cargando catálogo y comisiones...</p>
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
                      <td style={{ padding: '10px', color: '#25D366', fontWeight: 'bold' }}>
                        RD$ {(item.precioInstalacion || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px' }}>{item.porcentajeComision || 0}%</td>
                      <td style={{ padding: '10px', fontWeight: 'bold', color: '#E50914' }}>
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
                          {estaPagado ? ' PAGADO' : ' PENDIENTE'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {citasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                      No hay registros completados con instalación para este filtro.
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
