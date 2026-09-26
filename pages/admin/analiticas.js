// pages/admin/analiticas.js
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AnaliticasDashboard() {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  
  // Filtro de período seleccionado: 'mesActual', 'mesPasado', 'ultimos7Dias', 'hoy', 'todos'
  const [filtroPeriodo, setFiltroPeriodo] = useState('mesActual');

  // Métricas calculadas dinámicamente
  const [ventasPeriodo, setVentasPeriodo] = useState(0);
  const [ventasDiarias, setVentasDiarias] = useState(0);
  const [ventasSemanales, setVentasSemanales] = useState(0);
  const [ventasMensuales, setVentasMensuales] = useState(0);
  const [ventasMesPasado, setVentasMesPasado] = useState(0);
  const [productosMasVendidos, setProductosMasVendidos] = useState([]);
  const [ingresosPorZona, setIngresosPorZona] = useState({});
  const [totalPedidosCount, setTotalPedidosCount] = useState(0);

  useEffect(() => {
    cargarDatosAnalitica();
  }, []);

  useEffect(() => {
    if (pedidos.length > 0) {
      calcularMetricas(pedidos, filtroPeriodo);
    }
  }, [filtroPeriodo, pedidos]);

  const cargarDatosAnalitica = async () => {
    try {
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      const listaPedidos = [];
      snapPedidos.forEach((doc) => {
        listaPedidos.push({ id: doc.id, ...doc.data() });
      });
      setPedidos(listaPedidos);
      calcularMetricas(listaPedidos, 'mesActual');
    } catch (error) {
      console.error("Error al cargar datos para analíticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const calcularMetricas = (listaPedidos, periodo) => {
    let tTotal = 0;
    let tDiario = 0;
    let tSemanal = 0;
    let tMensual = 0;
    let tMesPasado = 0;
    let tFiltrado = 0;

    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    
    const hace7Dias = new Date();
    hace7Dias.setDate(ahora.getDate() - 7);

    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    // Calcular Mes Pasado
    const fechaMesPasado = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const mesPasadoIndex = fechaMesPasado.getMonth();
    const anioMesPasado = fechaMesPasado.getFullYear();

    const prodConteo = {};
    const zonaConteo = {};
    let cuentaPedidosFiltrados = 0;

    listaPedidos.forEach((p) => {
      const monto = Number(p.total || 0);

      // Procesar fecha del pedido
      let fechaPedido = ahora;
      if (p.fecha?.toDate) {
        fechaPedido = p.fecha.toDate();
      } else if (p.fecha) {
        fechaPedido = new Date(p.fecha);
      }

      const tiempoPedido = fechaPedido.getTime();

      // Métricas de tarjetas fijas (independientes del filtro)
      if (p.estado !== 'Cancelado') {
        tTotal += monto;

        if (tiempoPedido >= inicioHoy) tDiario += monto;
        if (fechaPedido >= hace7Dias) tSemanal += monto;
        if (fechaPedido.getMonth() === mesActual && fechaPedido.getFullYear() === anioActual) tMensual += monto;
        if (fechaPedido.getMonth() === mesPasadoIndex && fechaPedido.getFullYear() === anioMesPasado) tMesPasado += monto;
      }

      // Evaluar si cumple con el filtro seleccionado para la vista detallada
      let cumpleFiltro = true;
      if (periodo === 'mesActual') {
        cumpleFiltro = fechaPedido.getMonth() === mesActual && fechaPedido.getFullYear() === anioActual;
      } else if (periodo === 'mesPasado') {
        cumpleFiltro = fechaPedido.getMonth() === mesPasadoIndex && fechaPedido.getFullYear() === anioMesPasado;
      } else if (periodo === 'ultimos7Dias') {
        cumpleFiltro = fechaPedido >= hace7Dias;
      } else if (periodo === 'hoy') {
        cumpleFiltro = tiempoPedido >= inicioHoy;
      }

      if (cumpleFiltro && p.estado !== 'Cancelado') {
        tFiltrado += monto;
        cuentaPedidosFiltrados++;

        // Productos más vendidos del periodo
        if (p.productosDetalle && Array.isArray(p.productosDetalle)) {
          p.productosDetalle.forEach((item) => {
            const nombreProd = item.nombre || 'Producto sin nombre';
            const cantidad = Number(item.cantidad || 1);
            prodConteo[nombreProd] = (prodConteo[nombreProd] || 0) + cantidad;
          });
        } else if (p.detalles) {
          prodConteo[p.detalles] = (prodConteo[p.detalles] || 0) + 1;
        }

        // Ingresos por Zona del periodo
        const zona = p.zonaEnvio || p.direccion || 'No especificada';
        zonaConteo[zona] = (zonaConteo[zona] || 0) + monto;
      }
    });

    setVentasTotales(tTotal);
    setVentasDiarias(tDiario);
    setVentasSemanales(tSemanal);
    setVentasMensuales(tMensual);
    setVentasMesPasado(tMesPasado);
    setVentasPeriodo(tFiltrado);
    setTotalPedidosCount(cuentaPedidosFiltrados);

    const productosOrdenados = Object.keys(prodConteo)
      .map((nombre) => ({ nombre, cantidad: prodConteo[nombre] }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
      
    setProductosMasVendidos(productosOrdenados);
    setIngresosPorZona(zonaConteo);
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', padding: '30px 20px', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E50914', paddingBottom: '15px', marginBottom: '25px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#E50914', textTransform: 'uppercase', margin: 0 }}>
            📊 GR Analíticas & Reportes
          </h1>
          <p style={{ fontSize: '12px', color: '#888', margin: '4px 0 0 0' }}>Métricas financieras y rendimiento de inventario</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.location.href = '/admin/pedidos'} style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            📦 Ver Pedidos
          </button>
          <button onClick={() => window.location.href = '/admin/dashboard'} style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            Volver al Panel
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '50px 0' }}>Calculando analíticas financieras...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* TARJETAS DE VENTAS GENERALES */}
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '12px' }}>💰 Resumen Financiero Rápido</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '15px' }}>
                
                <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '18px' }}>
                  <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Ventas de Hoy</span>
                  <h3 style={{ fontSize: '22px', fontWeight: '900', color: '#25D366', margin: '6px 0 0 0' }}>
                    RD$ {ventasDiarias.toLocaleString()}
                  </h3>
                </div>

                <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '18px' }}>
                  <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Últimos 7 Días</span>
                  <h3 style={{ fontSize: '22px', fontWeight: '900', color: '#25D366', margin: '6px 0 0 0' }}>
                    RD$ {ventasSemanales.toLocaleString()}
                  </h3>
                </div>

                <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '18px' }}>
                  <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Mes Actual</span>
                  <h3 style={{ fontSize: '22px', fontWeight: '900', color: '#25D366', margin: '6px 0 0 0' }}>
                    RD$ {ventasMensuales.toLocaleString()}
                  </h3>
                </div>

                <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '18px' }}>
                  <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>📅 Mes Pasado</span>
                  <h3 style={{ fontSize: '22px', fontWeight: '900', color: '#38BDF8', margin: '6px 0 0 0' }}>
                    RD$ {ventasMesPasado.toLocaleString()}
                  </h3>
                </div>

              </div>
            </div>

            {/* BARRA DE FILTRO DE PERÍODO PARA PRODUCTOS Y ZONAS */}
            <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#FFF' }}>🔍 Filtrar Reporte Detallado</h3>
                <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Ventas en este periodo: <strong style={{ color: '#25D366' }}>RD$ {ventasPeriodo.toLocaleString()}</strong> ({totalPedidosCount} órdenes)</p>
              </div>

              <select
                value={filtroPeriodo}
                onChange={(e) => setFiltroPeriodo(e.target.value)}
                style={{ backgroundColor: '#1F1F1F', color: '#FFB800', border: '1px solid #444', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
              >
                <option value="mesActual">📅 Mes Actual</option>
                <option value="mesPasado">📅 Mes Pasado (Comparativa)</option>
                <option value="ultimos7Dias">⚡ Últimos 7 Días</option>
                <option value="hoy">⭐ Hoy</option>
                <option value="todos">📦 Todo el Histórico</option>
              </select>
            </div>

            {/* PRODUCTOS MÁS VENDIDOS & ZONAS SEGÚN EL FILTRO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '15px' }}>🔥 Productos Más Vendidos</h2>
                {productosMasVendidos.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>No hay registros en este período.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {productosMasVendidos.map((prod, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1A1A', padding: '10px 12px', borderRadius: '6px', border: '1px solid #252525' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ backgroundColor: '#E50914', color: '#FFF', fontSize: '11px', fontWeight: 'bold', width: '22px', height: '22px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%' }}>
                            {index + 1}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{prod.nombre}</span>
                        </div>
                        <span style={{ fontSize: '12px', color: '#25D366', fontWeight: 'bold' }}>{prod.cantidad} un.</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '15px' }}>📍 Ingresos por Zonas de Envío</h2>
                {Object.keys(ingresosPorZona).length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>No hay registros en este período.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                    {Object.entries(ingresosPorZona).map(([zona, monto], index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1A1A', padding: '10px 12px', borderRadius: '6px', border: '1px solid #252525' }}>
                        <span style={{ fontSize: '13px', color: '#DDD' }}>{zona}</span>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#25D366' }}>RD$ {monto.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}
      </div>
    </div>
  );
}
