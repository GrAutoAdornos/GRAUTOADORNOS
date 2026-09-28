import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function ReporteComisionesTecnicos() {
  const [citasCompletadas, setCitasCompletadas] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoFiltro, setTecnicoFiltro] = useState('todos');
  const [filtroPago, setFiltroPago] = useState('todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(true);
  const [modoRecibo, setModoRecibo] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // 1. Cargar catálogo de productos para mapear precios de instalación
      const snapProductos = await getDocs(collection(db, 'productos'));
      const mapaPreciosInstalacion = {};
      snapProductos.forEach((docSnap) => {
        const prod = docSnap.data() || {};
        const nombreClave = String(prod.nombre || docSnap.id).toLowerCase().trim();
        mapaPreciosInstalacion[nombreClave] = Number(prod.precioInstalacion || prod.instalacion || prod.costoInstalacion || 0);
      });

      // 2. Cargar Lista de Técnicos
      const snapTecnicos = await getDocs(collection(db, 'tecnicos'));
      const listaTec = snapTecnicos.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTecnicos(listaTec);

      // 3. Cargar y procesar Citas Completadas
      await cargarCitasValidas(mapaPreciosInstalacion, listaTec);
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Extraer SOLAMENTE el precio de la instalación (Mano de Obra)
  const obtenerPrecioSoloInstalacion = (data, mapaPrecios) => {
    // Si la cita tiene un campo explícito de mano de obra
    if (Number(data.precioManoObra) > 0) return Number(data.precioManoObra);
    if (Number(data.precioInstalacion) > 0) return Number(data.precioInstalacion);
    if (Number(data.costoInstalacion) > 0) return Number(data.costoInstalacion);

    let sumaManoObra = 0;
    if (Array.isArray(data.productos)) {
      data.productos.forEach((p) => {
        const cant = Number(p.cantidad || 1);
        const montoInstDirecto = Number(p.precioInstalacion || p.instalacion || p.costoInstalacion || 0);
        
        if (montoInstDirecto > 0) {
          sumaManoObra += montoInstDirecto * cant;
        } else {
          const nombreProd = String(p.nombre || p.titulo || '').toLowerCase().trim();
          if (mapaPrecios[nombreProd]) {
            sumaManoObra += mapaPrecios[nombreProd] * cant;
          }
        }
      });
    }

    // Si no desglosa por producto pero se guardó el monto de instalación en la cita
    if (sumaManoObra > 0) return sumaManoObra;
    return Number(data.montoInstalacion || 0);
  };

  const cargarCitasValidas = async (mapaPrecios, listaTec) => {
    const snapPedidos = await getDocs(collection(db, 'pedidos'));
    let listaFinal = [];

    snapPedidos.forEach((docSnap) => {
      const data = docSnap.data() || {};
      
      // REGLA FUNDAMENTAL 1: Verificar que la cita esté COMPLETADA
      const estadoCita = String(data.estadoCita || data.estado || '').trim().toLowerCase();
      const esCompletada = estadoCita === 'completada' || estadoCita === 'completado';

      // REGLA FUNDAMENTAL 2: Que provenga de una CITA o tenga técnico asignado
      const tieneTecnico = Boolean(data.tecnicoId || data.tecnicoNombre);
      const esCitaValida = Boolean(data.esCita || data.fechaCita || data.fechaInstalacion || tieneTecnico);

      // Si NO está completada o NO es una cita de taller, la descartamos de inmediato
      if (!esCompletada || !esCitaValida) return;

      // Calcular solo mano de obra
      const precioInstalacion = obtenerPrecioSoloInstalacion(data, mapaPrecios);

      // Buscar técnico asignado
      let tecObj = listaTec.find(t => t.id === data.tecnicoId);
      if (!tecObj && data.tecnicoNombre) {
        tecObj = listaTec.find(t => String(t.nombre || '').toLowerCase().trim() === String(data.tecnicoNombre).toLowerCase().trim());
      }

      const tecnicoNombre = tecObj ? tecObj.nombre : (data.tecnicoNombre || 'Sin Técnico');
      const tecnicoId = tecObj ? tecObj.id : (data.tecnicoId || '');

      // % de comisión del técnico
      let porcentaje = Number(data.porcentajeComision || data.porcentaje) || 0;
      if (porcentaje === 0 && tecObj) {
        porcentaje = Number(tecObj.porcentajeDefecto || tecObj.porcentaje || 50);
      }

      // Cálculo exacto de comisión
      const montoComision = (precioInstalacion * porcentaje) / 100;

      // Detalle del servicio o productos
      let resumenTrabajo = data.detalles || data.vehiculo;
      if (!resumenTrabajo && Array.isArray(data.productos)) {
        resumenTrabajo = data.productos.map(p => `${p.nombre || p.titulo || 'Servicio'} (x${p.cantidad || 1})`).join(', ');
      }

      // Formatear Fecha
      let fechaTexto = new Date().toLocaleDateString();
      if (data.fechaInstalacion || data.fechaCita || data.fecha) {
        const f = data.fechaInstalacion || data.fechaCita || data.fecha;
        fechaTexto = f?.toDate ? f.toDate().toLocaleDateString() : String(f);
      }

      listaFinal.push({
        id: docSnap.id,
        codigoOrden: docSnap.id.substring(0, 7).toUpperCase(),
        clienteNombre: data.cliente || data.clienteNombre || data.nombre || 'Cliente General',
        vehiculoServicio: resumenTrabajo || 'Instalación de Accesorios',
        tecnicoId: tecnicoId,
        tecnicoNombre: tecnicoNombre,
        precioInstalacion: precioInstalacion,
        porcentajeComision: porcentaje,
        montoComision: montoComision,
        estadoPagoTecnico: String(data.estadoPagoTecnico || 'pendiente').toLowerCase(),
        fecha: fechaTexto,
        fechaRaw: data.fechaInstalacion || data.fechaCita || data.fecha
      });
    });

    setCitasCompletadas(listaFinal);
  };

  const cambiarEstadoPago = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === 'pagado' ? 'pendiente' : 'pagado';
    try {
      await updateDoc(doc(db, 'pedidos', id), { estadoPagoTecnico: nuevoEstado });
      setCitasCompletadas(prev => prev.map(c => c.id === id ? { ...c, estadoPagoTecnico: nuevoEstado } : c));
    } catch (err) {
      alert("Error al cambiar estado de pago");
    }
  };

  // Filtrado de la lista
  const citasFiltradas = citasCompletadas.filter((item) => {
    if (tecnicoFiltro !== 'todos' && item.tecnicoId !== tecnicoFiltro) return false;
    if (filtroPago === 'pendiente' && item.estadoPagoTecnico !== 'pendiente') return false;
    if (filtroPago === 'pagado' && item.estadoPagoTecnico !== 'pagado') return false;
    return true;
  });

  // Totales
  const totalManoObra = citasFiltradas.reduce((acc, c) => acc + c.precioInstalacion, 0);
  const totalComisiones = citasFiltradas.reduce((acc, c) => acc + c.montoComision, 0);

  const citasPagadas = citasFiltradas.filter(c => c.estadoPagoTecnico === 'pagado');
  const totalLiquidado = citasPagadas.reduce((acc, c) => acc + c.montoComision, 0);

  const tecObjSeleccionado = tecnicos.find(t => t.id === tecnicoFiltro);
  const nombreTecnicoActivo = tecObjSeleccionado ? tecObjSeleccionado.nombre : 'Todos los Técnicos';

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', padding: '25px', fontFamily: 'sans-serif' }}>
      
      {/* ESTILOS DE IMPRESIÓN (PUNTO 5) */}
      <style jsx global>{`
        @media print {
          body { background-color: #FFF !important; color: #000 !important; }
          .no-print { display: none !important; }
          .area-recibo {
            background-color: #FFF !important;
            color: #000 !important;
            border: 2px solid #000 !important;
            padding: 25px !important;
            box-shadow: none !important;
            width: 100% !important;
          }
          .area-recibo table { width: 100% !important; border-collapse: collapse !important; color: #000 !important; }
          .area-recibo th, .area-recibo td { border: 1px solid #000 !important; padding: 8px !important; color: #000 !important; }
          .area-recibo th { background-color: #F0F0F0 !important; }
          .texto-impresion { color: #000 !important; }
        }
      `}</style>

      {/* HEADER PRINCIPAL */}
      <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>Liquidación & Comisiones de Técnicos</h1>
          <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '13px' }}>Solo citas completadas y validadas por el taller</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/admin/citas">
            <button style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
               Volver a Citas
            </button>
          </Link>
          <Link href="/admin/dashboard">
            <button style={{ backgroundColor: '#141414', color: '#FFF', border: '1px solid #333', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
               Panel
            </button>
          </Link>
        </div>
      </header>

      {/* BARRA DE FILTROS (PUNTO 1 Y 2) */}
      <div className="no-print" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '25px', backgroundColor: '#141414', padding: '15px', borderRadius: '8px', border: '1px solid #222' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#AAA', marginBottom: '4px' }}>Técnico:</label>
          <select 
            value={tecnicoFiltro} 
            onChange={(e) => setTecnicoFiltro(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444', cursor: 'pointer' }}
          >
            <option value="todos">Todos los Técnicos ({tecnicos.length})</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#AAA', marginBottom: '4px' }}>Estado de Pago:</label>
          <select 
            value={filtroPago} 
            onChange={(e) => setFiltroPago(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFB800', border: '1px solid #FFB800', fontWeight: 'bold', cursor: 'pointer' }}
          >
            <option value="todos">Todos los Estados</option>
            <option value="pendiente">Solo Pendientes de Pago</option>
            <option value="pagado">Solo Pagados / Liquidados</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <button 
            onClick={() => setModoRecibo(!modoRecibo)}
            style={{ backgroundColor: modoRecibo ? '#333' : '#25D366', color: modoRecibo ? '#FFF' : '#000', padding: '10px 18px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {modoRecibo ? ' Ver Tabla de Trabajo' : ' Generar Recibo de Pago'}
          </button>
          <button 
            onClick={() => window.print()}
            style={{ backgroundColor: '#E50914', color: '#FFF', padding: '10px 18px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
             Imprimir Comprobante
          </button>
        </div>
      </div>

      {modoRecibo ? (
        /* VISTA DE FACTURA / COMPROBANTE DE IMPRESIÓN (PUNTOS 2, 3, 4 Y 5) */
        <div className="area-recibo" style={{ backgroundColor: '#141414', padding: '35px', borderRadius: '10px', border: '1px solid #333', maxWidth: '850px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E50914', paddingBottom: '15px', marginBottom: '20px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }} className="texto-impresion">GR AUTO ADORNOS</h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#AAA' }} className="texto-impresion">Servicios de Instalación & Accesorios Automotrices</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#E50914' }}>COMPROBANTE DE LIQUIDACIÓN</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#CCC' }} className="texto-impresion">Fecha Emisión: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div style={{ backgroundColor: '#1A1A1A', padding: '12px 18px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #333' }}>
            <p style={{ margin: 0, fontSize: '14px' }} className="texto-impresion">
              Técnico / Instalador: <strong>{nombreTecnicoActivo}</strong>
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
            <thead>
              <tr style={{ backgroundColor: '#222', color: '#FFF', textAlign: 'left' }}>
                <th style={{ padding: '10px', fontSize: '12px' }}>Fecha</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>Cliente / Trabajo Realizado</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>Mano de Obra</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>% Com.</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>Comisión a Entregar</th>
              </tr>
            </thead>
            <tbody>
              {citasFiltradas.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #333', fontSize: '13px' }}>
                  <td style={{ padding: '10px' }} className="texto-impresion">{item.fecha}</td>
                  <td style={{ padding: '10px' }} className="texto-impresion">{item.clienteNombre} - {item.vehiculoServicio}</td>
                  <td style={{ padding: '10px' }} className="texto-impresion">RD$ {item.precioInstalacion.toLocaleString()}</td>
                  <td style={{ padding: '10px' }} className="texto-impresion">{item.porcentajeComision}%</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#25D366' }} className="texto-impresion">
                    RD$ {item.montoComision.toLocaleString()}
                  </td>
                </tr>
              ))}
              {citasFiltradas.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                    No hay citas completadas disponibles para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0D0D0D', padding: '15px 20px', borderRadius: '8px', border: '1px solid #333', marginBottom: '50px' }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }} className="texto-impresion">TOTAL A PAGAR / ENTREGAR:</span>
            <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#25D366' }} className="texto-impresion">RD$ {totalComisiones.toLocaleString()}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 30px' }}>
            <div style={{ width: '220px', borderTop: '1px solid #888', paddingTop: '8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }} className="texto-impresion">Firma del Técnico</p>
              <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#888' }} className="texto-impresion">{nombreTecnicoActivo}</p>
            </div>
            <div style={{ width: '220px', borderTop: '1px solid #888', paddingTop: '8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }} className="texto-impresion">Aprobado Administración</p>
              <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#888' }} className="texto-impresion">GR Auto Adornos</p>
            </div>
          </div>

        </div>
      ) : (
        /* VISTA TABLA DE ADMINISTRACIÓN DE COMISIONES (PUNTO 3 Y 4) */
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
            <div style={{ backgroundColor: '#141414', padding: '18px', borderRadius: '8px', border: '1px solid #222' }}>
              <p style={{ color: '#AAA', margin: 0, fontSize: '12px' }}>Citas Completadas</p>
              <h3 style={{ margin: '5px 0 0 0', color: '#FFF', fontSize: '22px' }}>{citasFiltradas.length}</h3>
            </div>

            <div style={{ backgroundColor: '#141414', padding: '18px', borderRadius: '8px', border: '1px solid #222' }}>
              <p style={{ color: '#AAA', margin: 0, fontSize: '12px' }}>Total Mano de Obra</p>
              <h3 style={{ margin: '5px 0 0 0', color: '#25D366', fontSize: '22px' }}>RD$ {totalManoObra.toLocaleString()}</h3>
            </div>

            <div style={{ backgroundColor: '#141414', padding: '18px', borderRadius: '8px', border: '1px solid #E50914' }}>
              <p style={{ color: '#AAA', margin: 0, fontSize: '12px' }}>Total Comisiones Calculadas</p>
              <h3 style={{ margin: '5px 0 0 0', color: '#E50914', fontSize: '22px' }}>RD$ {totalComisiones.toLocaleString()}</h3>
            </div>
          </div>

          {loading ? (
            <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>Cargando datos del taller...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#1A1A1A', color: '#FFF', borderBottom: '2px solid #333' }}>
                  <th style={{ padding: '12px', fontSize: '13px' }}>Fecha</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>Cliente / Vehículo / Servicio</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>Técnico</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>Mano de Obra</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>% Com.</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>Comisión a Pagar</th>
                  <th style={{ padding: '12px', fontSize: '13px' }} className="no-print">Estado de Pago</th>
                </tr>
              </thead>
              <tbody>
                {citasFiltradas.map((item) => {
                  const estaPagado = item.estadoPagoTecnico === 'pagado';

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#AAA' }}>{item.fecha}</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>
                        <strong>{item.clienteNombre}</strong>
                        <br />
                        <span style={{ fontSize: '11px', color: '#888' }}>{item.vehiculoServicio}</span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{item.tecnicoNombre}</td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#25D366', fontWeight: 'bold' }}>
                        RD$ {item.precioInstalacion.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{item.porcentajeComision}%</td>
                      <td style={{ padding: '12px', fontSize: '13px', fontWeight: 'bold', color: '#E50914' }}>
                        RD$ {item.montoComision.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px' }} className="no-print">
                        <button
                          onClick={() => cambiarEstadoPago(item.id, item.estadoPagoTecnico)}
                          style={{
                            backgroundColor: estaPagado ? '#1C3829' : '#381C1C',
                            color: estaPagado ? '#25D366' : '#FF4D4D',
                            border: estaPagado ? '1px solid #25D366' : '1px solid #FF4D4D',
                            padding: '6px 14px',
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
                    <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                      No hay citas completadas para este filtro.
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
