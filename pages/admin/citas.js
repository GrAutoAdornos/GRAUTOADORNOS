// pages/admin/citas.js
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

// Lista de instaladores/técnicos registrados
const LISTA_TECNICOS = [
  { id: 't1', nombre: 'Carlos López', porcentaje: 20 },
  { id: 't2', nombre: 'Marcos Ramírez', porcentaje: 25 },
  { id: 't3', nombre: 'Juan Pérez', porcentaje: 20 },
];

export default function CitasAdmin() {
  const router = useRouter();
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('TODAS'); // 'TODAS', 'PENDIENTES', 'COMPLETADAS'
  const [filtroFecha, setFiltroFecha] = useState('TODAS');

  // Función para imprimir citas a PDF
  const exportarCitasPDF = () => {
    window.print();
  };

  // Estado para el formulario de cita manual
  const [mostrarModal, setMostrarModal] = useState(false);
  const [nuevaCita, setNuevaCita] = useState({
    cliente: '',
    telefono: '',
    fechaInstalacion: '',
    horaInstalacion: '1:00 PM',
    detalles: 'Instalación Manual Admin',
    tecnicoId: 't1',
    precioManoObra: 0,
  });

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) {
      router.push('/admin/login');
      return;
    }
    cargarCitas();
  }, [router]);

  const cargarCitas = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'pedidos'));
      const list = [];
      snap.forEach((d) => {
        const data = d.data();
        const fecha = data.fechaInstalacion || data.fechaCita;
        const hora = data.horaInstalacion || data.horaCita;

        if (fecha) {
          list.push({ 
            id: d.id, 
            clienteNombre: data.cliente || data.nombre || data.clienteNombre || 'Cliente General',
            telefono: data.telefono || data.phone || '',
            detalles: data.detalles || data.productos || 'Sin detalles',
            estadoCita: data.estadoCita || 'Pendiente',
            fechaCita: fecha,
            horaCita: hora || 'Hora por definir',
            tecnicoNombre: data.tecnicoNombre || 'Sin asignar',
            precioManoObra: data.precioManoObra || 0,
            montoComision: data.montoComision || 0,
            ...data 
          });
        }
      });
      setCitas(list);
    } catch (error) {
      console.error("Error al cargar citas:", error);
    } finally {
      setLoading(false);
    }
  };

  // Obtener lista única y ordenada de fechas
  const listaFechasSabados = useMemo(() => {
    const fechasUnicas = Array.from(new Set(citas.map((c) => c.fechaCita).filter(Boolean)));
    return fechasUnicas.sort();
  }, [citas]);

  // Cambiar estado de la cita (Pendiente / Completada)
  const cambiarEstadoCita = async (idPedido, estadoActual) => {
    const nuevoEstado = estadoActual === 'Completada' ? 'Pendiente' : 'Completada';
    try {
      const refPedido = doc(db, 'pedidos', idPedido);
      await updateDoc(refPedido, { estadoCita: nuevoEstado });

      setCitas((prev) =>
        prev.map((c) => (c.id === idPedido ? { ...c, estadoCita: nuevoEstado } : c))
      );
    } catch (error) {
      console.error("Error al actualizar estado de la cita:", error);
    }
  };

  // Crear cita manual calculando automáticamente la comisión del técnico
  const crearCitaManual = async (e) => {
    e.preventDefault();
    if (!nuevaCita.cliente || !nuevaCita.fechaInstalacion) {
      alert("Por favor completa el nombre y la fecha.");
      return;
    }

    try {
      const tecnicoObj = LISTA_TECNICOS.find((t) => t.id === nuevaCita.tecnicoId) || LISTA_TECNICOS[0];
      const manoObra = Number(nuevaCita.precioManoObra) || 0;
      const comisionCalculada = (manoObra * tecnicoObj.porcentaje) / 100;

      const nuevoDoc = {
        cliente: nuevaCita.cliente,
        telefono: nuevaCita.telefono,
        detalles: nuevaCita.detalles,
        estadoCita: 'Pendiente',
        fechaInstalacion: nuevaCita.fechaInstalacion,
        horaInstalacion: nuevaCita.horaInstalacion,
        fechaCita: nuevaCita.fechaInstalacion,
        horaCita: nuevaCita.horaInstalacion,
        tecnicoId: tecnicoObj.id,
        tecnicoNombre: tecnicoObj.nombre,
        porcentajeComision: tecnicoObj.porcentaje,
        precioManoObra: manoObra,
        montoComision: comisionCalculada,
        creadoEn: new Date().toISOString()
      };

      await addDoc(collection(db, 'pedidos'), nuevoDoc);
      alert("¡Cita manual asignada con éxito!");
      setMostrarModal(false);
      setNuevaCita({
        cliente: '',
        telefono: '',
        fechaInstalacion: '',
        horaInstalacion: '1:00 PM',
        detalles: 'Instalación Manual Admin',
        tecnicoId: 't1',
        precioManoObra: 0,
      });
      cargarCitas();
    } catch (error) {
      console.error("Error al guardar la cita manual:", error);
      alert("Hubo un error al guardar la cita.");
    }
  };

  // Filtrar citas
  const citasFiltradas = citas.filter((c) => {
    if (filtroEstado === 'PENDIENTES' && c.estadoCita !== 'Pendiente') return false;
    if (filtroEstado === 'COMPLETADAS' && c.estadoCita !== 'Completada') return false;
    if (filtroFecha !== 'TODAS' && c.fechaCita !== filtroFecha) return false;
    return true;
  });

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* 🖨️ ESTILOS EXCLUSIVOS PARA IMPRESIÓN Y PDF */}
      <style jsx global>{`
        @media print {
          body { background-color: #FFF !important; color: #000 !important; }
          header, nav, button, select, .no-print { display: none !important; }
          .card-cita { border: 1px solid #CCC !important; color: #000 !important; background-color: #FFF !important; }
        }
      `}</style>

      {/* HEADER */}
      <header className="no-print" style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>CITAS E INSTALACIONES</span></span>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>
            Volver al Panel
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '25px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Agenda de Servicios Agendados</h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#888' }}>Organiza las instalaciones en el taller para el técnico y los clientes.</p>
          </div>

          <div className="no-print" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #FFB800',
                backgroundColor: '#141414',
                color: '#FFB800',
                fontSize: '12px',
                fontWeight: 'bold',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="TODAS">📅 Todos los Sábados</option>
              {listaFechasSabados.map((fecha) => (
                <option key={fecha} value={fecha}>
                  Sábado: {fecha}
                </option>
              ))}
            </select>

            <button
              onClick={() => setMostrarModal(true)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#E50914', color: '#FFF', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ➕ Cita Manual
            </button>

            <button
              onClick={() => setFiltroEstado('TODAS')}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #333', backgroundColor: filtroEstado === 'TODAS' ? '#E50914' : '#141414', color: '#FFF', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Todas ({citas.length})
            </button>

            <button
              onClick={() => setFiltroEstado('PENDIENTES')}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #FFB800', backgroundColor: filtroEstado === 'PENDIENTES' ? '#FFB800' : '#141414', color: filtroEstado === 'PENDIENTES' ? '#000' : '#FFB800', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Pendientes
            </button>

            <button
              onClick={() => setFiltroEstado('COMPLETADAS')}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #25D366', backgroundColor: filtroEstado === 'COMPLETADAS' ? '#25D366' : '#141414', color: filtroEstado === 'COMPLETADAS' ? '#000' : '#25D366', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Completadas
            </button>

            <button
              onClick={exportarCitasPDF}
              style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #555', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
            >
              🖨️ Imprimir Citas (PDF)
            </button>
          </div>
        </div>

        {/* MODAL CITA MANUAL Y ASIGNACIÓN DE TÉCNICO */}
        {mostrarModal && (
          <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#141414', padding: '25px', borderRadius: '10px', width: '100%', maxWidth: '420px', border: '1px solid #E50914' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#FFF' }}>Agendar Cita / Asignar Técnico</h3>
              <form onSubmit={crearCitaManual} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Nombre del Cliente"
                  value={nuevaCita.cliente}
                  onChange={(e) => setNuevaCita({ ...nuevaCita, cliente: e.target.value })}
                  style={{ width: '100%', padding: '10px', backgroundColor: '#0D0D0D', border: '1px solid #333', color: '#FFF', borderRadius: '6px' }}
                  required
                />
                <input
                  type="text"
                  placeholder="Teléfono"
                  value={nuevaCita.telefono}
                  onChange={(e) => setNuevaCita({ ...nuevaCita, telefono: e.target.value })}
                  style={{ width: '100%', padding: '10px', backgroundColor: '#0D0D0D', border: '1px solid #333', color: '#FFF', borderRadius: '6px' }}
                />
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="date"
                    value={nuevaCita.fechaInstalacion}
                    onChange={(e) => setNuevaCita({ ...nuevaCita, fechaInstalacion: e.target.value })}
                    style={{ flex: 1, padding: '10px', backgroundColor: '#0D0D0D', border: '1px solid #333', color: '#FFF', borderRadius: '6px' }}
                    required
                  />
                  <select
                    value={nuevaCita.horaInstalacion}
                    onChange={(e) => setNuevaCita({ ...nuevaCita, horaInstalacion: e.target.value })}
                    style={{ flex: 1, padding: '10px', backgroundColor: '#0D0D0D', border: '1px solid #333', color: '#FFF', borderRadius: '6px' }}
                  >
                    <option value="1:00 PM">1:00 PM</option>
                    <option value="4:00 PM">4:00 PM</option>
                  </select>
                </div>

                {/* Seleccionar Técnico */}
                <label style={{ fontSize: '12px', color: '#AAA', marginBottom: '-6px' }}>Técnico Asignado:</label>
                <select
                  value={nuevaCita.tecnicoId}
                  onChange={(e) => setNuevaCita({ ...nuevaCita, tecnicoId: e.target.value })}
                  style={{ width: '100%', padding: '10px', backgroundColor: '#0D0D0D', border: '1px solid #333', color: '#FFF', borderRadius: '6px' }}
                >
                  {LISTA_TECNICOS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} ({t.porcentaje}% Comisión)
                    </option>
                  ))}
                </select>

                {/* Mano de Obra */}
                <label style={{ fontSize: '12px', color: '#AAA', marginBottom: '-6px' }}>Precio Mano de Obra (RD$):</label>
                <input
                  type="number"
                  placeholder="Monto Mano de Obra"
                  value={nuevaCita.precioManoObra}
                  onChange={(e) => setNuevaCita({ ...nuevaCita, precioManoObra: e.target.value })}
                  style={{ width: '100%', padding: '10px', backgroundColor: '#0D0D0D', border: '1px solid #333', color: '#FFF', borderRadius: '6px' }}
                />

                <textarea
                  placeholder="Detalles / Servicio a Realizar"
                  value={nuevaCita.detalles}
                  onChange={(e) => setNuevaCita({ ...nuevaCita, detalles: e.target.value })}
                  style={{ width: '100%', padding: '10px', backgroundColor: '#0D0D0D', border: '1px solid #333', color: '#FFF', borderRadius: '6px', minHeight: '60px' }}
                />

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="submit" style={{ flex: 1, backgroundColor: '#E50914', color: '#FFF', padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Guardar Cita
                  </button>
                  <button type="button" onClick={() => setMostrarModal(false)} style={{ flex: 1, backgroundColor: '#333', color: '#FFF', padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* LISTADO DE CITAS */}
        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>Cargando agenda de citas...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
            {citasFiltradas.length === 0 ? (
              <p style={{ color: '#888', gridColumn: '1 / -1', textAlign: 'center', padding: '30px', backgroundColor: '#141414', borderRadius: '8px', border: '1px solid #222' }}>
                No hay citas agendadas para la selección actual.
              </p>
            ) : (
              citasFiltradas.map((c) => {
                const esCompletada = c.estadoCita === 'Completada';
                const telLimpio = String(c.telefono || '').replace(/\D/g, '');

                return (
                  <div 
                    key={c.id} 
                    className="card-cita"
                    style={{ 
                      backgroundColor: '#141414', 
                      border: esCompletada ? '1px solid #25D366' : '1px solid #E50914', 
                      borderRadius: '10px', 
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justify: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#FFB800', fontWeight: 'bold' }}>
                          📅 {c.fechaCita} - 🕒 {c.horaCita}
                        </span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: esCompletada ? '#1C3829' : '#382D1C', color: esCompletada ? '#25D366' : '#FFB800', fontWeight: 'bold' }}>
                          {c.estadoCita || 'Pendiente'}
                        </span>
                      </div>

                      <h4 style={{ margin: '5px 0', fontSize: '16px' }}>{c.clienteNombre}</h4>
                      <p style={{ margin: '2px 0 8px 0', fontSize: '12px', color: '#AAA' }}>📞 Tel: {c.telefono || 'No registrado'}</p>
                      
                      <div style={{ backgroundColor: '#0D0D0D', padding: '10px', borderRadius: '6px', border: '1px solid #222', fontSize: '12px', marginBottom: '10px' }}>
                        <strong>Servicio / Productos:</strong>
                        <p style={{ margin: '4px 0 0 0', color: '#BBB' }}>{c.detalles}</p>
                      </div>

                      {/* Info de Técnico y Comisión */}
                      <div style={{ backgroundColor: '#1A1A1A', padding: '8px 10px', borderRadius: '6px', fontSize: '11px', marginBottom: '15px', borderLeft: '3px solid #25D366' }}>
                        <div>👷‍ <strong>Técnico:</strong> {c.tecnicoNombre}</div>
                        {c.precioManoObra > 0 && (
                          <div style={{ color: '#25D366', marginTop: '3px' }}>
                            💰 Mano de Obra: RD$ {c.precioManoObra.toLocaleString()} | Com: RD$ {c.montoComision.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="no-print" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {telLimpio && (
                        <a
                          href={`https://wa.me/1${telLimpio}?text=${encodeURIComponent(`Hola ${c.clienteNombre}, te escribimos de GR Auto Adornos para recordarte tu cita de instalación programada para el ${c.fechaCita}. ¡Te esperamos!`)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ flex: 1, backgroundColor: '#25D366', color: '#000', textAlign: 'center', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}
                        >
                          📲 WhatsApp
                        </a>
                      )}

                      <button
                        onClick={() => cambiarEstadoCita(c.id, c.estadoCita)}
                        style={{ flex: 1, backgroundColor: '#222', color: esCompletada ? '#FFB800' : '#25D366', border: '1px solid #444', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {esCompletada ? '🔄 Pendiente' : '✅ Completada'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
