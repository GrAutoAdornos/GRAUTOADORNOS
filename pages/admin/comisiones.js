import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function ReporteComisiones() {
  const [citasCompletadas, setCitasCompletadas] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoFiltro, setTecnicoFiltro] = useState('todos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    await Promise.all([obtenerTecnicos(), obtenerCitasCompletadas()]);
    setLoading(false);
  };

  // Cargar lista dinámica de técnicos desde la colección 'tecnicos'
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

  // Cargar citas/pedidos completados desde Firebase
  const obtenerCitasCompletadas = async () => {
    try {
      // Intenta consultar la colección 'pedidos' o 'citas'
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      let lista = [];

      snapPedidos.forEach((doc) => {
        const data = doc.data();
        const estado = data.estadoCita || data.estado;
        if (estado === 'Completada' || estado === 'Completado') {
          lista.push({
            id: doc.id,
            clienteNombre: data.cliente || data.nombre || data.clienteNombre || 'Cliente General',
            vehiculo: data.vehiculo || data.detalles || 'Servicio General',
            tecnicoId: data.tecnicoId || '',
            tecnicoNombre: data.tecnicoNombre || 'Sin Asignar',
            precioManoObra: Number(data.precioManoObra) || 0,
            porcentajeComision: Number(data.porcentajeComision) || 0,
            montoComision: Number(data.montoComision) || 0,
            ...data
          });
        }
      });

      // Si no encontró nada en 'pedidos', intenta con la colección 'citas'
      if (lista.length === 0) {
        const qCitas = query(collection(db, 'citas'), where('estado', '==', 'Completado'));
        const snapCitas = await getDocs(qCitas);
        snapCitas.forEach((doc) => {
          const data = doc.data();
          lista.push({
            id: doc.id,
            clienteNombre: data.clienteNombre || data.cliente || 'Cliente General',
            vehiculo: data.vehiculo || data.detalles || 'Servicio General',
            tecnicoId: data.tecnicoId || '',
            tecnicoNombre: data.tecnicoNombre || 'Sin Asignar',
            precioManoObra: Number(data.precioManoObra) || 0,
            porcentajeComision: Number(data.porcentajeComision) || 0,
            montoComision: Number(data.montoComision) || 0,
            ...data
          });
        });
      }

      setCitasCompletadas(lista);
    } catch (error) {
      console.error("Error al obtener las citas completadas:", error);
    }
  };

  // Filtrar citas según el técnico seleccionado
  const citasFiltradas = tecnicoFiltro === 'todos' 
    ? citasCompletadas 
    : citasCompletadas.filter(c => c.tecnicoId === tecnicoFiltro);

  // Totales acumulados
  const totalManoObra = citasFiltradas.reduce((acc, curr) => acc + (curr.precioManoObra || 0), 0);
  const totalComisiones = citasFiltradas.reduce((acc, curr) => acc + (curr.montoComision || 0), 0);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* Ocultar elementos al imprimir */}
      <style jsx global>{`
        @media print {
          body { background-color: #FFF !important; color: #000 !important; }
          header, nav, button, select, .no-print { display: none !important; }
          table { width: 100% !important; color: #000 !important; }
          th, td { border-bottom: 1px solid #CCC !important; color: #000 !important; }
        }
      `}</style>

      <header style={{ marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
        <h2>👷‍♂️ Reporte de Comisiones de Técnicos</h2>
      </header>

      {/* Controles de filtro y exportación */}
      <div className="no-print" style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
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

        <button 
          onClick={() => window.print()}
          style={{ backgroundColor: '#E50914', color: '#FFF', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          🖨️ Imprimir / Guardar PDF
        </button>
      </div>

      {/* Tarjetas de Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
          <p style={{ color: '#AAA', margin: 0, fontSize: '14px' }}>Trabajos Completados</p>
          <h3 style={{ margin: '5px 0 0 0', color: '#FFF' }}>{citasFiltradas.length}</h3>
        </div>

        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
          <p style={{ color: '#AAA', margin: 0, fontSize: '14px' }}>Total Mano de Obra</p>
          <h3 style={{ margin: '5px 0 0 0', color: '#25D366' }}>RD$ {totalManoObra.toLocaleString()}</h3>
        </div>

        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', border: '1px solid #E50914' }}>
          <p style={{ color: '#AAA', margin: 0, fontSize: '14px' }}>Total Comisiones a Pagar</p>
          <h3 style={{ margin: '5px 0 0 0', color: '#E50914' }}>RD$ {totalComisiones.toLocaleString()}</h3>
        </div>
      </div>

      {/* Tabla detallada de trabajos */}
      {loading ? (
        <p style={{ color: '#888', textAlign: 'center', padding: '30px' }}>Cargando reporte de comisiones...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#222', color: '#FFF', borderBottom: '2px solid #444' }}>
              <th style={{ padding: '10px' }}>Cliente / Vehículo</th>
              <th style={{ padding: '10px' }}>Técnico</th>
              <th style={{ padding: '10px' }}>Mano de Obra</th>
              <th style={{ padding: '10px' }}>% Com.</th>
              <th style={{ padding: '10px' }}>Comisión a Pagar</th>
            </tr>
          </thead>
          <tbody>
            {citasFiltradas.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ padding: '10px' }}>{item.clienteNombre} - {item.vehiculo}</td>
                <td style={{ padding: '10px' }}>{item.tecnicoNombre}</td>
                <td style={{ padding: '10px' }}>RD$ {(item.precioManoObra || 0).toLocaleString()}</td>
                <td style={{ padding: '10px' }}>{item.porcentajeComision || 0}%</td>
                <td style={{ padding: '10px', fontWeight: 'bold', color: '#25D366' }}>
                  RD$ {(item.montoComision || 0).toLocaleString()}
                </td>
              </tr>
            ))}
            {citasFiltradas.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                  No hay instalaciones completadas registradas para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

    </div>
  );
}
