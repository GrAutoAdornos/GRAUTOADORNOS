// pages/admin/analiticas.js
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AnaliticasDashboard() {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);

  // Estado para el filtro de mes seleccionado ('actual', 'pasado', 'todos')
  const [filtroMes, setFiltroMes] = useState('actual');

  // Métricas calculadas
  const [ventasTotales, setVentasTotales] = useState(0);
  const [ventasDiarias, setVentasDiarias] = useState(0);
  const [ventasSemanales, setVentasSemanales] = useState(0);
  const [ventasMensuales, setVentasMensuales] = useState(0);
  const [productosMasVendidos, setProductosMasVendidos] = useState([]);
  const [ingresosPorZona, setIngresosPorZona] = useState({});
  const [totalPedidosCount, setTotalPedidosCount] = useState(0);

  useEffect(() => {
    cargarDatosAnalitica();
  }, []);

  // Recalcular métricas cada vez que cambie el filtro de mes o se carguen los pedidos
  useEffect(() => {
    if (pedidos.length > 0) {
      calcularMetricas(pedidos, filtroMes);
    }
  }, [filtroMes, pedidos]);

  const cargarDatosAnalitica = async () => {
    try {
      // 1. Cargar Pedidos
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      const listaPedidos = [];
      snapPedidos.forEach((doc) => {
        listaPedidos.push({ id: doc.id, ...doc.data() });
      });
      setPedidos(listaPedidos);
      setTotalPedidosCount(listaPedidos.length);

      // 2. Cargar Productos (Inventario)
      const snapProductos = await getDocs(collection(db, 'productos'));
      const listaProductos = [];
      snapProductos.forEach((doc) => {
        listaProductos.push({ id: doc.id, ...doc.data() });
      });
      setProductos(listaProductos);

      // 3. Procesar Métricas Financieras y Estadísticas iniciales
      calcularMetricas(listaPedidos, filtroMes);

    } catch (error) {
      console.error("Error al cargar datos para analíticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const calcularMetricas = (listaPedidos, modoFiltro) => {
    let tTotal = 0;
    let tDiario = 0;
    let tSemanal = 0;
    let tMensual = 0;

    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    
    // Hace 7 días
    const hace7Dias = new Date();
    hace7Dias.setDate(ahora.getDate() - 7);

    // Mes y año actual
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    // Mes y año pasado
    let mesPasado = mesActual - 1;
    let anioMesPasado = anioActual;
    if (mesPasado < 0) {
      mesPasado = 11;
      anioMesPasado = anioActual - 1;
    }

    // Contadores auxiliares
    const prodConteo = {};
    const zonaConteo = {};
    let cuentaPedidosFiltrados = 0;

    listaPedidos.forEach((p) => {
      const monto = Number(p.total || 0);

      // Procesar fecha del pedido (soporta timestamp de Firebase o campo fecha string/Date)
      let fechaPedido = ahora;
      if (p.fecha?.toDate) {
        fechaPedido = p.fecha.toDate();
      } else if (p.fecha) {
        fechaPedido = new Date(p.fecha);
      }

      // Aplicar validación según el filtro de mes seleccionado
      let cumpleFiltroMes = true;
      if (modoFiltro === 'actual') {
        cumpleFiltroMes = (fechaPedido.getMonth() === mesActual && fechaPedido.getFullYear() === anioActual);
      } else if (modoFiltro === 'pasado') {
        cumpleFiltroMes = (fechaPedido.getMonth() === mesPasado && fechaPedido.getFullYear() === anioMesPasado);
      } // Si es 'todos', pasa sin restricciones

      if (cumpleFiltroMes) {
        cuentaPedidosFiltrados++;

        // Si el pedido no está cancelado, suma a las finanzas del filtro
        if (p.estado !== 'Cancelado') {
          tTotal += monto;

          const tiempoPedido = fechaPedido.getTime();

          // Diarias (hoy)
          if (tiempoPedido >= inicioHoy) {
            tDiario += monto;
          }

          // Semanales (últimos 7 días)
          if (fechaPedido >= hace7Dias) {
            tSemanal += monto;
          }

          // Mensuales (mes actual fijo para tarjeta comparativa o mes en curso)
          if (fechaPedido.getMonth() === mesActual && fechaPedido.getFullYear() === anioActual) {
            tMensual += monto;
          }
        }

        // Conteo de Productos más vendidos (basado en productosDetalle o campo detalles)
        if (p.productosDetalle && Array.isArray(p.productosDetalle)) {
          p.productosDetalle.forEach((item) => {
            const nombreProd = item.nombre || 'Producto sin nombre';
            const cantidad = Number(item.cantidad || 1);
            prodConteo[nombreProd] = (prodConteo[nombreProd] || 0) + cantidad;
          });
        } else if (p.detalles) {
          // Fallback si viene en texto plano
          prodConteo[p.detalles] = (prodConteo[p.detalles] || 0) + 1;
        }

        // Conteo por Zonas de Envío
        const zona = p.zonaEnvio || p.direccion || 'No especificada';
        zonaConteo[zona] = (zonaConteo[zona] || 0) + Number(p.total || 0);
      }
    });

    setVentasTotales(tTotal);
    setVentasDiarias(tDiario);
    setVentasSemanales(tSemanal);
    setVentasMensuales(tMensual);
    setTotalPedidosCount(cuentaPedidosFiltrados);

    // Ordenar productos más vendidos de mayor a menor
    const productosOrdenados = Object.keys(prodConteo)
      .map((nombre) => ({ nombre, cantidad: prodConteo[nombre] }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5); // Top 5
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
          <p style={{ fontSize: '12px', color: '#888', margin: '4px 0 0 0' }}>Métricas en tiempo real del negocio y rendimiento de inventario</p>
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

      {/* BARRA DE FILTRO DE MES */}
      <div style={{ maxWidth: '1000px', margin: '0 auto 20px auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', backgroundColor: '#141414', padding: '12px 15px', borderRadius: '8px', border: '1px solid #222' }}>
        <span style={{ fontSize: '13px', color: '#FFB800', fontWeight: 'bold' }}>📅 Filtrar Periodo:</span>
        <select 
          value={filtroMes} 
          onChange={(e) => setFiltroMes(e.target.value)}
          style={{ backgroundColor: '#1A1A1A', color: '#FFF', border: '1px solid #444', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
        >
          <option value="actual">Mes Actual</option>
          <option value="pasado">Mes Pasado</option>
          <option value="todos">Todo el Histórico</option>
        </select>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '50px 0' }}>Calculando analíticas financieras...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* TARJETAS DE VENTAS TOTALES */}
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '12px' }}>💰 Resumen de Ventas (RD$)</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                
                <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                  <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Ventas de Hoy</span>
                  <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#25D366', margin: '8px 0 0 0' }}>
                    RD$ {ventasDiarias.toLocaleString()}
                  </h3>
                </div>

                <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                  <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Últimos 7 Días</span>
                  <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#25D366', margin: '8px 0 0 0' }}>
                    RD$ {ventasSemanales.toLocaleString()}
                  </h3>
                </div>

                <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                  <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Mes Actual</span>
                  <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#25D366', margin: '8px 0 0 0' }}>
                    RD$ {ventasMensuales.toLocaleString()}
                  </h3>
                </div>

                <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                  <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>
                    {filtroMes === 'pasado' ? 'Ventas del Mes Pasado' : filtroMes === 'actual' ? 'Ventas del Mes Actual' : 'Ventas Históricas Totales'}
                  </span>
                  <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#E50914', margin: '8px 0 0 0' }}>
                    RD$ {ventasTotales.toLocaleString()}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#666' }}>Total de órdenes en filtro: {totalPedidosCount}</span>
                </div>

              </div>
            </div>

            {/* PRODUCTOS MÁS VENDIDOS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '15px' }}>🔥 Productos con Mayor Rotación</h2>
                {productosMasVendidos.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>Aún no hay suficientes datos de productos vendidos en este periodo.</p>
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
                        <span style={{ fontSize: '12px', color: '#25D366', fontWeight: 'bold' }}>{prod.cantidad} unidades</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* INGRESOS POR ZONAS DE ENVÍO */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '15px' }}>📍 Ingresos por Zonas de Envío</h2>
                {Object.keys(ingresosPorZona).length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>No hay registros de zonas de envío en este periodo.</p>
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
