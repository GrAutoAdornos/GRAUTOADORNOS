import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';

export default function ReporteComisiones() {
  const router = useRouter();
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
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      let lista = [];

      snapPedidos.forEach((doc) => {
        const data = doc.data();
        const estado = data.estadoCita || data.estado;
        if (estado === 'Completada' || estado === 'Completado') {
          // Extraer precio de instalación (prioriza precioInstalacion, luego costoInstalacion, luego precioManoObra o monto total de instalación)
          const precioInstalacion = Number(data.precioInstalacion || data.costoInstalacion || data.instalacion || data.precioManoObra) || 0;
          const porcentajeComision = Number(data.porcentajeComision || data.porcentaje) || 0;
          
          // Calcular comisión automática si no viene definida
          let montoComision = Number(data.montoComision) || 0;
          if (montoComision === 0 && precioInstalacion > 0 && porcentajeComision > 0) {
            montoComision = (precioInstalacion * porcentajeComision) / 100;
          }

          lista.push({
            id: doc.id,
            clienteNombre: data.cliente || data.nombre || data.clienteNombre || 'Cliente General',
            vehiculo: data.vehiculo || data.detalles || data.productos || 'Servicio de Instalación',
            tecnicoId: data.tecnicoId || '',
            tecnicoNombre: data.tecnicoNombre || 'Sin Asignar',
            precioInstalacion: precioInstalacion,
            porcentajeComision: porcentajeComision,
            montoComision: montoComision,
            ...data
          });
        }
      });

      // Si la colección usada es 'citas' directamente
      if (lista.length === 0) {
        const qCitas = query(collection(db, 'citas'), where('estado', '==', 'Completado'));
        const snapCitas = await getDocs(qCitas);
        snapCitas.forEach((doc) => {
          const data = doc.data();
          const precioInstalacion = Number(data.precioInstalacion || data.costoInstalacion || data.instalacion || data.precioManoObra) || 0;
          const porcentajeComision = Number(data.porcentajeComision || data.porcentaje) || 0;
          
          let montoComision = Number(data.montoComision) || 0;
          if (montoComision === 0 && precioInstalacion > 0 && porcentajeComision > 0) {
            montoComision = (precioInstalacion * porcentajeComision) / 100;
          }

          lista.push({
            id: doc.id,
            clienteNombre: data.clienteNombre || data.cliente || 'Cliente General',
            vehiculo: data.vehiculo || data.detalles || 'Servicio General',
            tecnicoId: data.tecnicoId || '',
            tecnicoNombre: data.tecnicoNombre || 'Sin Asignar',
            precioInstalacion: precioInstalacion,
            porcentajeComision: porcentajeComision,
            montoComision: montoComision,
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

  // Re-calcular dinámicamente si el técnico tiene un porcentaje asignado
  const citasConCalculo = citasFiltradas.map((item) => {
    const tecObj = tecnicos.find((t) => t.id === item.tecnicoId);
    const porcentaje = item.porcentajeComision || (tecObj ? Number(tecObj.porcentajeDefecto || tecObj.porcentaje) : 0);
    const comision = item.montoComision > 0 
      ? item.montoComision 
      : (item.precioInstalacion * porcentaje) / 100;

    return {
      ...item,
      porcentajeComision: porcentaje,
      montoComision: comision
    };
  });

  // Totales acumulados
  const totalInstalaciones = citasConCalculo.reduce((acc, curr) => acc + (curr.precioInstalacion || 0), 0);
  const totalComisiones = citasConCalculo.reduce((acc, curr) => acc + (curr.montoComision || 0), 0);

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

      {/* HEADER Y NAVEGACIÓN */}
      <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link href="/admin/citas">
            <button style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              ← Volver a Citas
            </button>
          </Link>
          <h2 style={{ margin: 0, fontSize: '20px' }}>👷‍♂️ Reporte de Comisiones de Técnicos</h2>
        </div>

        <Link href="/admin/dashboard">
          <button style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
            Volver al Panel
          </button>
        </Link>
      </header>

      {/* CONTROLES DE FILTRO Y EXPORTACIÓN */}
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

      {/* TARJETAS DE RESUMEN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
          <p style={{ color: '#AAA', margin: 0, fontSize: '14px' }}>Trabajos Completados</p>
          <h3 style={{ margin: '5px 0 0 0', color: '#FFF' }}>{citasConCalculo.length}</h3>
        </div>

        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
          <p style={{ color: '#AAA', margin: 0, fontSize: '14px' }}>Total Precio Instalación</p>
          <h3 style={{ margin: '5px 0 0 0', color: '#25D366' }}>RD$ {totalInstalaciones.toLocaleString()}</h3>
        </div>

        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', border: '1px solid #E50914' }}>
          <p style={{ color: '#AAA', margin: 0, fontSize: '14px' }}>Total Comisiones a Pagar</p>
          <h3 style={{ margin: '5px 0 0 0', color: '#E50914' }}>RD$ {totalComisiones.toLocaleString()}</h3>
        </div>
      </div>

      {/* TABLA DETALLADA DE TRABAJOS */}
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
            </tr>
          </thead>
          <tbody>
            {citasConCalculo.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ padding: '10px' }}>{item.clienteNombre} - {item.vehiculo}</td>
                <td style={{ padding: '10px' }}>{item.tecnicoNombre}</td>
                <td style={{ padding: '10px' }}>RD$ {(item.precioInstalacion || 0).toLocaleString()}</td>
                <td style={{ padding: '10px' }}>{item.porcentajeComision || 0}%</td>
                <td style={{ padding: '10px', fontWeight: 'bold', color: '#25D366' }}>
                  RD$ {(item.montoComision || 0).toLocaleString()}
                </td>
              </tr>
            ))}
            {citasConCalculo.length === 0 && (
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
