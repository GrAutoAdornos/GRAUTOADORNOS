import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function ReporteComisionesTecnicos() {
  const [citasList, setCitasList] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoFiltro, setTecnicoFiltro] = useState('todos');
  const [filtroPago, setFiltroPago] = useState('todos');
  const [filtroEstadoCita, setFiltroEstadoCita] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [modoRecibo, setModoRecibo] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // 1. Cargar Técnicos
      const snapTecnicos = await getDocs(collection(db, 'tecnicos'));
      const listaTec = snapTecnicos.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTecnicos(listaTec);

      // 2. Cargar Citas / Pedidos
      await cargarCitas(listaTec);
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoading(false);
    }
  };

  const cargarCitas = async (listaTec) => {
    const snapPedidos = await getDocs(collection(db, 'pedidos'));
    let listaFinal = [];

    snapPedidos.forEach((docSnap) => {
      const data = docSnap.data() || {};
      
      // Estado normalizado de la cita
      const estadoCita = String(data.estadoCita || data.estado || 'pendiente').trim().toLowerCase();
      
      // EXCLUSIÓN: Descartar si está cancelado o rechazado
      if (estadoCita === 'cancelada' || estadoCita === 'cancelado' || estadoCita === 'rechazada') return;

      // CÁLCULO DE MANO DE OBRA POR ÍTEMS O DOCUMENTO
      let manoObra = 0;

      if (Array.isArray(data.productos) && data.productos.length > 0) {
        data.productos.forEach((p) => {
          const cant = Number(p.cantidad || 1);
          // Buscar costoInstalacion / precioInstalacion / instalacion en cada item del carrito
          const instProd = Number(
            p.costoInstalacion ?? 
            p.precioInstalacion ?? 
            p.instalacion ?? 
            p.precioManoObra ?? 
            0
          );
          manoObra += instProd * cant;
        });
      }

      // Si no se encontró valor en el desglose de productos, buscar a nivel de pedido
      if (manoObra === 0) {
        manoObra = Number(
          data.costoInstalacion ?? 
          data.precioInstalacion ?? 
          data.montoInstalacion ?? 
          data.precioManoObra ?? 
          0
        );
      }

      // Buscar técnico asignado
      let tecObj = listaTec.find(t => t.id === data.tecnicoId);
      if (!tecObj && data.tecnicoNombre) {
        tecObj = listaTec.find(t => String(t.nombre || '').toLowerCase().trim() === String(data.tecnicoNombre).toLowerCase().trim());
      }

      const tecnicoNombre = tecObj ? tecObj.nombre : (data.tecnicoNombre || 'Sin Asignar');
      const tecnicoId = tecObj ? tecObj.id : (data.tecnicoId || '');

      // Obtener Porcentaje del Técnico
      let porcentaje = Number(data.porcentajeComision || data.porcentaje) || 0;
      if (porcentaje === 0 && tecObj) {
        porcentaje = Number(tecObj.porcentajeDefecto || tecObj.porcentaje || 50);
      }

      // CALCULO DE COMISIÓN (% sobre Mano de Obra)
      const montoComision = (manoObra * porcentaje) / 100;

      // Resumen del Vehículo / Producto
      let detalleTrabajo = data.detalles || data.vehiculo;
      if (!detalleTrabajo && Array.isArray(data.productos)) {
        detalleTrabajo = data.productos.map(p => `${p.nombre || p.titulo || 'Producto'} (x${p.cantidad || 1})`).join(', ');
      }

      // Formatear Fecha
      let fechaTexto = new Date().toLocaleDateString();
      if (data.fechaInstalacion || data.fechaCita || data.fecha) {
        const f = data.fechaInstalacion || data.fechaCita || data.fecha;
        fechaTexto = f?.toDate ? f.toDate().toLocaleDateString() : String(f);
      }

      listaFinal.push({
        id: docSnap.id,
        clienteNombre: data.cliente || data.clienteNombre || data.nombre || 'Cliente General',
        vehiculoServicio: detalleTrabajo || 'Servicio de Instalación',
        tecnicoId: tecnicoId,
        tecnicoNombre: tecnicoNombre,
        manoObra: manoObra,
        porcentajeComision: porcentaje,
        montoComision: montoComision,
        estadoCita: estadoCita,
        estadoPagoTecnico: String(data.estadoPagoTecnico || 'pendiente').toLowerCase(),
        fecha: fechaTexto
      });
    });

    setCitasList(listaFinal);
  };

  const cambiarEstadoPago = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === 'pagado' ? 'pendiente' : 'pagado';
    try {
      await updateDoc(doc(db, 'pedidos', id), { estadoPagoTecnico: nuevoEstado });
      setCitasList(prev => prev.map(c => c.id === id ? { ...c, estadoPagoTecnico: nuevoEstado } : c));
    } catch (err) {
      alert("Error al actualizar el estado de pago.");
    }
  };

  // Filtrado general
  const citasFiltradas = citasList.filter((item) => {
    if (tecnicoFiltro !== 'todos' && item.tecnicoId !== tecnicoFiltro) return false;
    if (filtroPago === 'pendiente' && item.estadoPagoTecnico !== 'pendiente') return false;
    if (filtroPago === 'pagado' && item.estadoPagoTecnico !== 'pagado') return false;
    
    // Filtro de Estado de Cita
    const esComp = item.estadoCita === 'completada' || item.estadoCita === 'completado';
    if (filtroEstadoCita === 'completada' && !esComp) return false;
    if (filtroEstadoCita === 'pendiente' && esComp) return false;

    return true;
  });

  // Totales
  const totalManoObra = citasFiltradas.reduce((acc, c) => acc + c.manoObra, 0);
  const totalComisiones = citasFiltradas.reduce((acc, c) => acc + c.montoComision, 0);

  const tecObjSeleccionado = tecnicos.find(t => t.id === tecnicoFiltro);
  const nombreTecnicoActivo = tecObjSeleccionado ? tecObjSeleccionado.nombre : 'Todos los Técnicos';

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', padding: '25px', fontFamily: 'sans-serif' }}>
      
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

      {/* HEADER */}
      <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>Control de Comisiones de Técnicos</h1>
          <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '13px' }}>Cálculo exacto sobre mano de obra / instalación</p>
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

      {/* FILTROS */}
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
          <label style={{ display: 'block', fontSize: '11px', color: '#AAA', marginBottom: '4px' }}>Estado de Cita:</label>
          <select 
            value={filtroEstadoCita} 
            onChange={(e) => setFiltroEstadoCita(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444', cursor: 'pointer' }}
          >
            <option value="todos">Todas las Citas</option>
            <option value="completada">Solo Completadas</option>
            <option value="pendiente">Solo Pendientes</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#AAA', marginBottom: '4px' }}>Estado de Pago:</label>
          <select 
            value={filtroPago} 
            onChange={(e) => setFiltroPago(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#25D366', border: '1px solid #25D366', fontWeight: 'bold', cursor: 'pointer' }}
          >
            <option value="todos">Todos los Estados de Pago</option>
            <option value="pendiente">Solo Pendientes de Pago</option>
            <option value="pagado">Solo Pagados</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <button 
            onClick={() => setModoRecibo(!modoRecibo)}
            style={{ backgroundColor: modoRecibo ? '#333' : '#25D366', color: modoRecibo ? '#FFF' : '#000', padding: '10px 18px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {modoRecibo ? ' Ver Tabla' : ' Ver Recibo de Pago'}
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
        /* VISTA DE RECIBO DE PAGO */
        <div className="area-recibo" style={{ backgroundColor: '#141414', padding: '35px', borderRadius: '10px', border: '1px solid #333', maxWidth: '850px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E50914', paddingBottom: '15px', marginBottom: '20px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }} className="texto-impresion">GR AUTO ADORNOS</h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#AAA' }} className="texto-impresion">Comprobante de Pago a Técnicos</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#E50914' }}>RECIBO DE COMISIONES</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#CCC' }} className="texto-impresion">Fecha: {new Date().toLocaleDateString()}</p>
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
                <th style={{ padding: '10px', fontSize: '12px' }}>Cliente / Trabajo</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>Mano de Obra</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>% Com.</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>Comisión a Pagar</th>
              </tr>
            </thead>
            <tbody>
              {citasFiltradas.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #333', fontSize: '13px' }}>
                  <td style={{ padding: '10px' }} className="texto-impresion">{item.fecha}</td>
                  <td style={{ padding: '10px' }} className="texto-impresion">{item.clienteNombre} - {item.vehiculoServicio}</td>
                  <td style={{ padding: '10px' }} className="texto-impresion">RD$ {item.manoObra.toLocaleString()}</td>
                  <td style={{ padding: '10px' }} className="texto-impresion">{item.porcentajeComision}%</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#25D366' }} className="texto-impresion">
                    RD$ {item.montoComision.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0D0D0D', padding: '15px 20px', borderRadius: '8px', border: '1px solid #333', marginBottom: '50px' }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }} className="texto-impresion">TOTAL A ENTREGAR:</span>
            <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#25D366' }} className="texto-impresion">RD$ {totalComisiones.toLocaleString()}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 30px' }}>
            <div style={{ width: '220px', borderTop: '1px solid #888', paddingTop: '8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }} className="texto-impresion">Firma del Técnico</p>
              <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#888' }} className="texto-impresion">{nombreTecnicoActivo}</p>
            </div>
            <div style={{ width: '220px', borderTop: '1px solid #888', paddingTop: '8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }} className="texto-impresion">Administración</p>
              <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#888' }} className="texto-impresion">GR Auto Adornos</p>
            </div>
          </div>
        </div>
      ) : (
        /* VISTA DE TABLA CON COLORES INVERTIDOS (VERDE COMPLETADA / ROJO PENDIENTE) */
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
            <div style={{ backgroundColor: '#141414', padding: '18px', borderRadius: '8px', border: '1px solid #222' }}>
              <p style={{ color: '#AAA', margin: 0, fontSize: '12px' }}>Total Citas Evaluadas</p>
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
            <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>Cargando información...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#1A1A1A', color: '#FFF', borderBottom: '2px solid #333' }}>
                  <th style={{ padding: '12px', fontSize: '13px' }}>Fecha</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>Cliente / Trabajo</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>Técnico</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>Estado Cita</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>Mano de Obra</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>% Com.</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>Comisión</th>
                  <th style={{ padding: '12px', fontSize: '13px' }} className="no-print">Pago Técnico</th>
                </tr>
              </thead>
              <tbody>
                {citasFiltradas.map((item) => {
                  const esCompletada = item.estadoCita === 'completada' || item.estadoCita === 'completado';
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
                      
                      {/* ESTADO CITA: VERDE PARA COMPLETADA, ROJO PARA PENDIENTE */}
                      <td style={{ padding: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                        <span style={{
                          backgroundColor: esCompletada ? '#1C3829' : '#381C1C',
                          color: esCompletada ? '#25D366' : '#FF4D4D',
                          border: esCompletada ? '1px solid #25D366' : '1px solid #FF4D4D',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          textTransform: 'uppercase'
                        }}>
                          {esCompletada ? 'COMPLETADA' : 'PENDIENTE'}
                        </span>
                      </td>

                      <td style={{ padding: '12px', fontSize: '13px', color: '#25D366', fontWeight: 'bold' }}>
                        RD$ {item.manoObra.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{item.porcentajeComision}%</td>
                      <td style={{ padding: '12px', fontSize: '13px', fontWeight: 'bold', color: '#E50914' }}>
                        RD$ {item.montoComision.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px' }} className="no-print">
                        <button
                          onClick={() => cambiarEstadoPago(item.id, item.estadoPagoTecnico)}
                          style={{
                            backgroundColor: estaPagado ? '#1C3829' : '#222',
                            color: estaPagado ? '#25D366' : '#AAA',
                            border: estaPagado ? '1px solid #25D366' : '1px solid #444',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          {estaPagado ? 'PAGADO' : 'PENDIENTE'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {citasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                      No se encontraron registros.
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
