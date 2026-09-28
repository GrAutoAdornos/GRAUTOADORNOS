import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import Link from 'next/link';

export default function ComisionesVendedores() {
  const [vendedores, setVendedores] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState('todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const snapVendedores = await getDocs(collection(db, 'vendedores'));
      const listaVendedores = snapVendedores.docs.map(d => ({ id: d.id, ...d.data() }));
      setVendedores(listaVendedores);

      const snapOrdenes = await getDocs(collection(db, 'ordenes'));
      const listaOrdenes = snapOrdenes.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrdenes(listaOrdenes);
    } catch (error) {
      console.error("Error al cargar información:", error);
    }
  };

  // Helper para obtener la base imponible de comisión (subtotal solo productos)
  const obtenerSubtotalProductos = (orden) => {
    if (orden.subtotalProductos !== undefined) return Number(orden.subtotalProductos);
    if (Array.isArray(orden.items) && orden.items.length > 0) {
      return orden.items.reduce((sum, item) => sum + (Number(item.precio || item.price || 0) * (item.cantidad || item.quantity || 1)), 0);
    }
    return Number(orden.total) || 0;
  };

  // Filtrar órdenes
  const ordenesFiltradas = ordenes.filter(orden => {
    // Solo considerar órdenes que tengan vendedor asignado
    if (!orden.vendedorId) return false;

    // Filtro por vendedor específico
    if (vendedorSeleccionado !== 'todos' && orden.vendedorId !== vendedorSeleccionado) {
      return false;
    }

    // Filtro por fecha
    if (fechaInicio) {
      const fechaOrden = new Date(orden.fecha || orden.createdAt);
      if (fechaOrden < new Date(fechaInicio)) return false;
    }
    if (fechaFin) {
      const fechaOrden = new Date(orden.fecha || orden.createdAt);
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59);
      if (fechaOrden > fin) return false;
    }

    return true;
  });

  // Calcular totales acumulados
  const totalVendido = ordenesFiltradas.reduce((sum, o) => sum + obtenerSubtotalProductos(o), 0);
  
  const totalComisiones = ordenesFiltradas.reduce((sum, o) => {
    if (o.montoComisionVendedor !== undefined) {
      return sum + Number(o.montoComisionVendedor);
    }
    const subtotal = obtenerSubtotalProductos(o);
    const porcentaje = Number(o.vendedorPorcentaje) || Number(o.porcentajeComisionVendedor) || 5;
    return sum + (subtotal * (porcentaje / 100));
  }, 0);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', padding: '20px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* CABECERA */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>💰 Comisiones de Vendedores</h2>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/admin/vendedores">
            <button style={{ backgroundColor: '#0070f3', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              ⚙️ Gestionar Vendedores
            </button>
          </Link>
          <Link href="/admin/dashboard">
            <button style={{ backgroundColor: '#222', border: '1px solid #444', color: '#FFF', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>
              Volver al Panel
            </button>
          </Link>
        </div>
      </header>

      {/* FILTROS */}
      <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px' }}>Vendedor:</label>
          <select 
            value={vendedorSeleccionado} 
            onChange={(e) => setVendedorSeleccionado(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
          >
            <option value="todos">Todos los vendedores</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px' }}>Fecha Inicio:</label>
          <input 
            type="date" 
            value={fechaInicio} 
            onChange={(e) => setFechaInicio(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px' }}>Fecha Fin:</label>
          <input 
            type="date" 
            value={fechaFin} 
            onChange={(e) => setFechaFin(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
          />
        </div>
      </div>

      {/* TARJETAS RESUMEN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #0070f3' }}>
          <span style={{ color: '#AAA', fontSize: '13px' }}>Base Productos Vendidos</span>
          <h3 style={{ margin: '5px 0 0 0', fontSize: '22px' }}>RD$ {totalVendido.toLocaleString()}</h3>
        </div>
        <div style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #2e7d32' }}>
          <span style={{ color: '#AAA', fontSize: '13px' }}>Total Comisiones a Pagar</span>
          <h3 style={{ margin: '5px 0 0 0', fontSize: '22px', color: '#4caf50' }}>RD$ {totalComisiones.toLocaleString()}</h3>
        </div>
      </div>

      {/* TABLA DE DETALLES DE VENTAS */}
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ backgroundColor: '#222', color: '#FFF' }}>
            <th style={{ padding: '10px' }}>Orden #</th>
            <th style={{ padding: '10px' }}>Vendedor</th>
            <th style={{ padding: '10px' }}>Cliente</th>
            <th style={{ padding: '10px' }}>Base Productos</th>
            <th style={{ padding: '10px' }}>% Com.</th>
            <th style={{ padding: '10px' }}>Comisión</th>
          </tr>
        </thead>
        <tbody>
          {ordenesFiltradas.map(orden => {
            const subtotalProd = obtenerSubtotalProductos(orden);
            const pct = Number(orden.vendedorPorcentaje) || Number(orden.porcentajeComisionVendedor) || 5;
            const comision = orden.montoComisionVendedor !== undefined 
              ? Number(orden.montoComisionVendedor) 
              : (subtotalProd * (pct / 100));

            return (
              <tr key={orden.id} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ padding: '10px' }}>#{orden.id.slice(-6)}</td>
                <td style={{ padding: '10px', fontWeight: 'bold' }}>{orden.vendedorNombre || 'N/A'}</td>
                <td style={{ padding: '10px', color: '#AAA' }}>{orden.clienteNombre || orden.nombreCliente || 'Cliente General'}</td>
                <td style={{ padding: '10px' }}>RD$ {subtotalProd.toLocaleString()}</td>
                <td style={{ padding: '10px' }}>{pct}%</td>
                <td style={{ padding: '10px', color: '#4caf50', fontWeight: 'bold' }}>RD$ {comision.toLocaleString()}</td>
              </tr>
            );
          })}
          {ordenesFiltradas.length === 0 && (
            <tr>
              <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                No hay ventas registradas con vendedor para el filtro seleccionado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
