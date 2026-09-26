// pages/admin/citas.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function CitasAdmin() {
  const router = useRouter();
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('TODAS'); // 'TODAS', 'PENDIENTES', 'COMPLETADAS'

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
        // Verificamos si tiene fecha de cita registrada
        if (data.fechaCita) {
          list.push({ 
            id: d.id, 
            clienteNombre: data.cliente || data.nombre || data.clienteNombre || 'Cliente General',
            telefono: data.telefono || data.phone || '',
            detalles: data.detalles || data.productos || 'Sin detalles',
            estadoCita: data.estadoCita || 'Pendiente',
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

  // Cambiar estado de la cita (Pendiente / Completada)
  const cambiarEstadoCita = async (idPedido, nuevoEstado) => {
    try {
      const refPedido = doc(db, 'pedidos', idPedido);
      await updateDoc(refPedido, { estadoCita: nuevoEstado });

      // Actualizar estado local
      setCitas((prev) =>
        prev.map((c) => (c.id === idPedido ? { ...c, estadoCita: nuevoEstado } : c))
      );
    } catch (error) {
      console.error("Error al actualizar estado de la cita:", error);
    }
  };

  // Filtrado de citas
  const citasFiltradas = citas.filter((c) => {
    if (filtroEstado === 'PENDIENTES') return c.estadoCita === 'Pendiente';
    if (filtroEstado === 'COMPLETADAS') return c.estadoCita === 'Completada';
    return true;
  });

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
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

          {/* Filtros rápidos */}
          <div style={{ display: 'flex', gap: '8px' }}>
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
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>Cargando agenda de citas...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {citasFiltradas.length === 0 ? (
              <p style={{ color: '#888', gridColumn: '1 / -1', textAlign: 'center', padding: '30px', backgroundColor: '#141414', borderRadius: '8px', border: '1px solid #222' }}>
                No hay citas agendadas en esta categoría.
              </p>
            ) : (
              citasFiltradas.map((c) => {
                const esCompletada = c.estadoCita === 'Completada';
                const telLimpio = String(c.telefono || '').replace(/\D/g, '');

                return (
                  <div 
                    key={c.id} 
                    style={{ 
                      backgroundColor: '#141414', 
                      border: esCompletada ? '1px solid #25D366' : '1px solid #E50914', 
                      borderRadius: '10px', 
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#FFB800', fontWeight: 'bold' }}>
                          📅 {c.fechaCita} - 🕒 {c.horaCita || 'Hora por definir'}
                        </span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: esCompletada ? '#1C3829' : '#382D1C', color: esCompletada ? '#25D366' : '#FFB800', fontWeight: 'bold' }}>
                          {c.estadoCita || 'Pendiente'}
                        </span>
                      </div>

                      <h4 style={{ margin: '5px 0', fontSize: '16px', color: '#FFF' }}>{c.clienteNombre}</h4>
                      <p style={{ margin: '2px 0 8px 0', fontSize: '12px', color: '#AAA' }}>📞 Tel: {c.telefono || 'No registrado'}</p>
                      
                      <div style={{ backgroundColor: '#0D0D0D', padding: '10px', borderRadius: '6px', border: '1px solid #222', fontSize: '12px', color: '#DDD', marginBottom: '15px' }}>
                        <strong>Servicio / Productos:</strong>
                        <p style={{ margin: '4px 0 0 0', color: '#BBB' }}>{c.detalles}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {telLimpio && (
                        <a
                          href={`https://wa.me/1${telLimpio}?text=${encodeURIComponent(`Hola ${c.clienteNombre}, te escribimos de GR Auto Adornos para recordarte tu cita de instalación programada para el ${c.fechaCita}. ¡Te esperamos!`)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ flex: 1, backgroundColor: '#25D366', color: '#000', textAlign: 'center', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}
                        >
                          📲 Recordar (WA)
                        </a>
                      )}

                      <button
                        onClick={() => cambiarEstadoCita(c.id, esCompletada ? 'Pendiente' : 'Completada')}
                        style={{ flex: 1, backgroundColor: '#222', color: esCompletada ? '#FFB800' : '#25D366', border: '1px solid #444', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {esCompletada ? '🔄 Marcar Pendiente' : '✅ Marcar Completada'}
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
