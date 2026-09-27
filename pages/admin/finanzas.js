// pages/admin/finanzas.js
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';
import * as XLSX from 'xlsx';

export default function FinanzasAdmin() {
  const router = useRouter();
  const [ventas, setVentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado para el formulario de nuevo gasto
  const [nuevoGasto, setNuevoGasto] = useState({
    descripcion: '',
    monto: '',
    categoria: 'Mercancía', // 'Mercancía', 'Pago Técnico', 'Local/Servicios', 'Otros'
    fecha: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) {
      router.push('/admin/login');
      return;
    }
    cargarDatos();
  }, [router]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // 1. Cargar Ventas (Pedidos/Citas)
      const snapVentas = await getDocs(collection(db, 'pedidos'));
      const listVentas = [];
      snapVentas.forEach((d) => {
        const data = d.data();
        listVentas.push({
          id: d.id,
          cliente: data.cliente || data.nombre || 'Cliente General',
          monto: Number(data.total || data.monto || 0),
          fecha: data.fecha || data.creadoEn?.split('T')[0] || 'Sin fecha',
          detalles: data.detalles || data.productos || 'Venta general'
        });
      });
      setVentas(listVentas);

      // 2. Cargar Gastos Operativos
      const snapGastos = await getDocs(collection(db, 'gastos'));
      const listGastos = [];
      snapGastos.forEach((d) => {
        listGastos.push({ id: d.id, ...d.data() });
      });
      setGastos(listGastos);
    } catch (error) {
      console.error("Error al cargar finanzas:", error);
    } finally {
      setLoading(false);
    }
  };

  // Registrar un nuevo gasto en Firestore
  const guardarGasto = async (e) => {
    e.preventDefault();
    if (!nuevoGasto.descripcion || !nuevoGasto.monto) {
      alert("Por favor completa la descripción y el monto.");
      return;
    }

    try {
      const gastoDoc = {
        ...nuevoGasto,
        monto: parseFloat(nuevoGasto.monto),
        creadoEn: new Date().toISOString()
      };

      const ref = await addDoc(collection(db, 'gastos'), gastoDoc);
      setGastos((prev) => [...prev, { id: ref.id, ...gastoDoc }]);
      
      setNuevoGasto({
        descripcion: '',
        monto: '',
        categoria: 'Mercancía',
        fecha: new Date().toISOString().split('T')[0]
      });
      alert("Gasto registrado con éxito.");
    } catch (error) {
      console.error("Error al registrar gasto:", error);
      alert("Error al guardar el gasto.");
    }
  };

  // Eliminar un gasto
  const eliminarGasto = async (id) => {
    if (!confirm("¿Deseas eliminar este registro de gasto?")) return;
    try {
      await deleteDoc(doc(db, 'gastos', id));
      setGastos((prev) => prev.filter((g) => g.id !== id));
    } catch (error) {
      console.error("Error al eliminar gasto:", error);
    }
  };

  // Cálculos Financieros
  const totalIngresos = useMemo(() => {
    return ventas.reduce((acc, v) => acc + (v.monto || 0), 0);
  }, [ventas]);

  const totalGastos = useMemo(() => {
    return gastos.reduce((acc, g) => acc + (g.monto || 0), 0);
  }, [gastos]);

  const gananciaNeta = totalIngresos - totalGastos;

  // Exportar Reporte Financiero a Excel
  const exportarAExcel = () => {
    const dataGastos = gastos.map((g) => ({
      Fecha: g.fecha,
      Categoría: g.categoria,
      Descripción: g.descripcion,
      'Monto (DOP)': g.monto
    }));

    const dataResumen = [
      { Concepto: 'Total Ingresos (Ventas)', Monto: totalIngresos },
      { Concepto: 'Total Gastos Operativos', Monto: totalGastos },
      { Concepto: 'Ganancia Neta Real', Monto: gananciaNeta }
    ];

    const wb = XLSX.utils.book_new();
    const wsResumen = XLSX.utils.json_to_sheet(dataResumen);
    const wsGastos = XLSX.utils.json_to_sheet(dataGastos);

    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Balance');
    XLSX.utils.book_append_sheet(wb, wsGastos, 'Detalle de Gastos');

    XLSX.writeFile(wb, `Reporte_Financiero_GR_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>CONTROL FINANCIERO</span></span>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>
            Volver al Panel
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '25px 20px' }}>
        
        {/* Encabezado y Botón de Exportación */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px' }}>Balance de Ventas y Gastos</h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#888' }}>Supervisa la rentabilidad neta real de GR Auto Adornos.</p>
          </div>
          <button
            onClick={exportarAExcel}
            style={{ backgroundColor: '#25D366', color: '#000', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
          >
            📊 Exportar Reporte (Excel)
          </button>
        </div>

        {/* TARJETAS DE RESUMEN FINANCIERO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 'bold' }}>INGRESOS BRUTOS</span>
            <h3 style={{ margin: '8px 0 0 0', fontSize: '24px', color: '#25D366' }}>
              ${totalIngresos.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </h3>
          </div>

          <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 'bold' }}>GASTOS OPERATIVOS</span>
            <h3 style={{ margin: '8px 0 0 0', fontSize: '24px', color: '#E50914' }}>
              ${totalGastos.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </h3>
          </div>

          <div style={{ backgroundColor: '#141414', border: gananciaNeta >= 0 ? '1px solid #FFB800' : '1px solid #E50914', borderRadius: '10px', padding: '20px' }}>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 'bold' }}>GANANCIA NETA REAL</span>
            <h3 style={{ margin: '8px 0 0 0', fontSize: '24px', color: gananciaNeta >= 0 ? '#FFB800' : '#E50914' }}>
              ${gananciaNeta.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        {/* FORMULARIO Y LISTADO DE GASTOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '25px' }}>
          
          {/* Formulario para registrar gasto */}
          <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px', height: 'fit-content' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#FFF' }}>➕ Registrar Nuevo Gasto</h3>
            <form onSubmit={guardarGasto} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Descripción del gasto (ej. Luces LED, Sueldo técnico)"
                value={nuevoGasto.descripcion}
                onChange={(e) => setNuevoGasto({ ...nuevoGasto, descripcion: e.target.value })}
                style={{ width: '100%', padding: '10px', backgroundColor: '#0D0D0D', border: '1px solid #333', color: '#FFF', borderRadius: '6px', fontSize: '13px' }}
                required
              />

              <input
                type="number"
                placeholder="Monto (DOP)"
                value={nuevoGasto.monto}
                onChange={(e) => setNuevoGasto({ ...nuevoGasto, monto: e.target.value })}
                style={{ width: '100%', padding: '10px', backgroundColor: '#0D0D0D', border: '1px solid #333', color: '#FFF', borderRadius: '6px', fontSize: '13px' }}
                required
              />

              <select
                value={nuevoGasto.categoria}
                onChange={(e) => setNuevoGasto({ ...nuevoGasto, categoria: e.target.value })}
                style={{ width: '100%', padding: '10px', backgroundColor: '#0D0D0D', border: '1px solid #333', color: '#FFF', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="Mercancía">Mercancía / Repuestos</option>
                <option value="Pago Técnico">Pago a Técnicos</option>
                <option value="Local/Servicios">Local / Servicios (Luz, Internet)</option>
                <option value="Otros">Otros Gastos</option>
              </select>

              <input
                type="date"
                value={nuevoGasto.fecha}
                onChange={(e) => setNuevoGasto({ ...nuevoGasto, fecha: e.target.value })}
                style={{ width: '100%', padding: '10px', backgroundColor: '#0D0D0D', border: '1px solid #333', color: '#FFF', borderRadius: '6px', fontSize: '13px' }}
                required
              />

              <button
                type="submit"
                style={{ backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}
              >
                Guardar Gasto
              </button>
            </form>
          </div>

          {/* Tabla de Historial de Gastos */}
          <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#FFF' }}>📋 Historial de Gastos Operativos</h3>

            {loading ? (
              <p style={{ color: '#888', fontSize: '13px' }}>Cargando datos financieros...</p>
            ) : gastos.length === 0 ? (
              <p style={{ color: '#888', fontSize: '13px' }}>No hay gastos registrados aún.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                {gastos.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      backgroundColor: '#0D0D0D',
                      border: '1px solid #222',
                      padding: '12px',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '14px', color: '#FFF', display: 'block' }}>{g.descripcion}</strong>
                      <span style={{ fontSize: '11px', color: '#888' }}>
                        📅 {g.fecha} | 🏷️ {g.categoria}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '14px', color: '#E50914', fontWeight: 'bold' }}>
                        -${Number(g.monto).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        onClick={() => eliminarGasto(g.id)}
                        style={{ backgroundColor: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px' }}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
