import { useState, useEffect } from 'react';
import { db } from '../../firebase/config'; // Ajusta la ruta a tu config de Firebase
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function ReporteComisiones() {
  const [citasCompletadas, setCitasCompletadas] = useState([]);
  const [tecnicoFiltro, setTecnicoFiltro] = useState('todos');

  useEffect(() => {
    obtenerCitasCompletadas();
  }, []);

  const obtenerCitasCompletadas = async () => {
    // Consultar citas completadas desde Firebase
    const q = query(collection(db, 'citas'), where('estado', '==', 'Completado'));
    const querySnapshot = await getDocs(q);
    const lista = [];
    querySnapshot.forEach((doc) => {
      lista.push({ id: doc.id, ...doc.data() });
    });
    setCitasCompletadas(lista);
  };

  // Filtrar citas según el técnico seleccionado
  const citasFiltradas = tecnicoFiltro === 'todos' 
    ? citasCompletadas 
    : citasCompletadas.filter(c => c.tecnicoId === tecnicoFiltro);

  // Totales acumulados
  const totalManoObra = citasFiltradas.reduce((acc, curr) => acc + (curr.precioManoObra || 0), 0);
  const totalComisiones = citasFiltradas.reduce((acc, curr) => acc + (curr.montoComision || 0), 0);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', padding: '20px' }}>
      
      {/* Ocultar botones al imprimir */}
      <style jsx global>{`
        @media print {
          body { background-color: #FFF !important; color: #000 !important; }
          header, nav, button, select, .no-print { display: none !important; }
        }
      `}</style>

      <header style={{ marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
        <h2>👷‍♂️ Reporte de Comisiones de Técnicos</h2>
      </header>

      {/* Controles de filtro y exportación */}
      <div className="no-print" style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select 
          value={tecnicoFiltro} 
          onChange={(e) => setTecnicoFiltro(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
        >
          <option value="todos">Todos los Técnicos</option>
          <option value="t1">Carlos López</option>
          <option value="t2">Marcos Ramírez</option>
          <option value="t3">Juan Pérez</option>
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
              <td style={{ padding: '10px' }}>{item.clienteNombre || 'Cliente'} - {item.vehiculo || 'Auto'}</td>
              <td style={{ padding: '10px' }}>{item.tecnicoNombre}</td>
              <td style={{ padding: '10px' }}>RD$ {(item.precioManoObra || 0).toLocaleString()}</td>
              <td style={{ padding: '10px' }}>{item.porcentajeComision}%</td>
              <td style={{ padding: '10px', fontWeight: 'bold', color: '#25D366' }}>
                RD$ {(item.montoComision || 0).toLocaleString()}
              </td>
            </tr>
          ))}
          {citasFiltradas.length === 0 && (
            <tr>
              <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                No hay instalaciones registradas para este filtro.
              </td>
            </tr>
          )}
        </tbody>
      </table>

    </div>
  );
}
