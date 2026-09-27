import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AnaliticasDashboard() {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);

  // Estado para el selector de mes (Formato YYYY-MM)
  const hoy = new Date();
  const mesActualStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const [mesSeleccionado, setMesSeleccionado] = useState(mesActualStr);

  // Métricas calculadas para el mes seleccionado
  const [ingresosBrutosMes, setIngresosBrutosMes] = useState(0);
  const [gastosMes, setGastosMes] = useState(0); // Para mantenimiento o costos extras si aplica
  const [gananciaNetaMes, setGananciaNetaMes] = useState(0);
  const [pedidosActivos, setPedidosActivos] = useState(0);
  const [pedidosPendientes, setPedidosPendientes] = useState(0);
  const [tasaCompletacion, setTasaCompletacion] = useState(0);

  // Comparativa mes anterior
  const [gananciaMesAnterior, setGananciaMesAnterior] = useState(0);
  const [porcentajeCrecimiento, setPorcentajeCrecimiento] = useState(0);
  const [diferenciaMonto, setDiferenciaMonto] = useState(0);

  // Rankings y listas
  const [rankingProductos, setRankingProductos] = useState([]);
  const [ingresosPorZona, setIngresosPorZona] = useState({});

  useEffect(() => {
    cargarDatosAnalitica();
  }, []);

  useEffect(() => {
    if (pedidos.length > 0) {
      calcularMetricasPorMes(pedidos, mesSeleccionado);
    }
  }, [mesSeleccionado, pedidos]);

  const cargarDatosAnalitica = async () => {
    try {
      setLoading(true);

      // 1. Cargar Pedidos
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      const listaPedidos = [];
      snapPedidos.forEach((doc) => {
        listaPedidos.push({ id: doc.id, ...doc.data() });
      });
      setPedidos(listaPedidos);

      // 2. Cargar Productos (Inventario)
      const snapProductos = await getDocs(collection(db, 'productos'));
      const listaProductos = [];
      snapProductos.forEach((doc) => {
        listaProductos.push({ id: doc.id, ...doc.data() });
      });
      setProductos(listaProductos);

      // 3. Calcular Métricas iniciales
      calcularMetricasPorMes(listaPedidos, mesSeleccionado);

    } catch (error) {
      console.error("Error al cargar datos para analíticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const obtenerFechaPedido = (p) => {
    if (p.fecha?.toDate) return p.fecha.toDate();
    if (p.fecha) return new Date(p.fecha);
    return new Date();
  };

  const calcularMetricasPorMes = (listaPedidos, mesAnio) => {
    const [yearSel, monthSel] = mesAnio.split('-').map(Number);
    const mesIndex = monthSel - 1;

    // Fechas mes anterior
    const fechaMesAnterior = new Date(yearSel, mesIndex - 1, 1);
    const yearAnt = fechaMesAnterior.getFullYear();
    const mesAntIndex = fechaMesAnterior.getMonth();

    let brutosMes = 0;
    let brutosMesAnt = 0;
    let activosCount = 0;
    let pendientesCount = 0;
    let completadosCount = 0;
    let totalPedidosMes = 0;

    const prodConteo = {};
    const zonaConteo = {};

    listaPedidos.forEach((p) => {
      const monto = Number(p.total || 0);
      const fechaPedido = obtenerFechaPedido(p);
      const pYear = fechaPedido.getFullYear();
      const pMonth = fechaPedido.getMonth();

      // Pedidos del Mes Seleccionado
      if (pYear === yearSel && pMonth === mesIndex) {
        totalPedidosMes++;

        if (p.estado !== 'Cancelado') {
          brutosMes += monto;

          // Conteos de Productos más vendidos/rentables
          if (p.productosDetalle && Array.isArray(p.productosDetalle)) {
            p.productosDetalle.forEach((item) => {
              const nombre = item.nombre || 'Producto sin nombre';
              const cant = Number(item.cantidad || 1);
              const totalItem = Number(item.precio || 0) * cant || monto;

              if (!prodConteo[nombre]) {
                prodConteo[nombre] = { cantidad: 0, total: 0 };
              }
              prodConteo[nombre].cantidad += cant;
              prodConteo[nombre].total += totalItem;
            });
          } else if (p.detalles) {
            const nombre = p.detalles;
            if (!prodConteo[nombre]) prodConteo[nombre] = { cantidad: 0, total: 0 };
            prodConteo[nombre].cantidad += 1;
            prodConteo[nombre].total += monto;
          }

          // Conteo por Zonas
          const zona = p.zonaEnvio || p.direccion || 'No especificada';
          zonaConteo[zona] = (zonaConteo[zona] || 0) + monto;
        }

        // Conteo por estados
        if (p.estado === 'Completado' || p.estado === 'Entregado') {
          completadosCount++;
        } else if (p.estado === 'En Proceso' || p.estado === 'En Camino') {
          activosCount++;
        } else if (p.estado === 'Pendiente') {
          pendientesCount++;
        }
      }

      // Pedidos del Mes Anterior
      if (pYear === yearAnt && pMonth === mesAntIndex) {
        if (p.estado !== 'Cancelado') {
          brutosMesAnt += monto;
        }
      }
    });

    // Cálculos Finales
    const gastosEst = 0; // Se puede modificar según los gastos guardados
    const netaMes = brutosMes - gastosEst;
    const netaMesAnt = brutosMesAnt;

    // Comparación porcentual vs Mes Anterior
    let dif = netaMes - netaMesAnt;
    let porcentaje = 0;
    if (netaMesAnt > 0) {
      porcentaje = (dif / netaMesAnt) * 100;
    } else if (netaMes > 0) {
      porcentaje = 100;
    }

    setIngresosBrutosMes(brutosMes);
    setGastosMes(gastosEst);
    setGananciaNetaMes(netaMes);
    setGananciaMesAnterior(netaMesAnt);
    setDiferenciaMonto(dif);
    setPorcentajeCrecimiento(porcentaje.toFixed(0));

    setPedidosActivos(activosCount);
    setPedidosPendientes(pendientesCount);
    setTasaCompletacion(totalPedidosMes > 0 ? Math.round((completadosCount / totalPedidosMes) * 100) : 0);

    // Ordenar ranking de productos
    const ranking = Object.keys(prodConteo)
      .map((nombre) => ({
        nombre,
        cantidad: prodConteo[nombre].cantidad,
        total: prodConteo[nombre].total
      }))
      .sort((a, b) => b.total - a.total);

    setRankingProductos(ranking);
    setIngresosPorZona(zonaConteo);
  };

  return (
    <div style={{ backgroundColor: '#0B0C10', color: '#FFF', minHeight: '100vh', padding: '30px 20px', fontFamily: 'sans-serif' }}>
      
      {/* Header y Selector de Mes */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '15px', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#FFB800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 Dashboard Financiero y Contabilidad
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Selector de Mes */}
          <div style={{ backgroundColor: '#141414', border: '1px solid #333', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#AAA' }}>📅 Seleccionar Mes:</span>
            <input
              type="month"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
              style={{ backgroundColor: '#000', color: '#FFB800', border: '1px solid #444', padding: '4px 8px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
            />
          </div>

          <button onClick={() => window.location.href = '/admin/pedidos'} style={{ backgroundColor: '#1F1F1F', color: '#FFF', border: '1px solid #444', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            📦 Ver Pedidos
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '50px 0' }}>Cargando analíticas financieras...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* SECCIÓN 1: TENDENCIA VS MES ANTERIOR */}
            <div style={{ backgroundColor: '#121212', border: '1px solid #222', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                  TENDENCIA VS MES ANTERIOR
                </div>
                <div style={{ fontSize: '13px', color: '#CCC', marginTop: '2px' }}>
                  Ganancia Neta Mes Anterior: <strong style={{ color: '#FFF' }}>RD$ {gananciaMesAnterior.toLocaleString()}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: porcentajeCrecimiento >= 0 ? 'rgba(37, 211, 102, 0.15)' : 'rgba(229, 9, 20, 0.15)', border: `1px solid ${porcentajeCrecimiento >= 0 ? '#25D366' : '#E50914'}`, padding: '6px 14px', borderRadius: '20px' }}>
                <span style={{ fontSize: '13px', fontWeight: '900', color: porcentajeCrecimiento >= 0 ? '#25D366' : '#E50914' }}>
                  {porcentajeCrecimiento >= 0 ? `📈 +${porcentajeCrecimiento}% (+RD$ ${diferenciaMonto.toLocaleString()}) ¡Subimos!` : `📉 ${porcentajeCrecimiento}% (RD$ ${diferenciaMonto.toLocaleString()})`}
                </span>
              </div>
            </div>

            {/* SECCIÓN 2: TARJETAS KPI DE MÉTRICAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>

              {/* Ingresos Brutos */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '8px', padding: '16px' }}>
                <span style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>INGRESOS BRUTOS (MES)</span>
                <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#25D366', margin: '6px 0 0 0' }}>
                  RD$ {ingresosBrutosMes.toLocaleString()}
                </h3>
              </div>

              {/* Gastos */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '8px', padding: '16px' }}>
                <span style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>GASTOS / COSTOS</span>
                <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#E50914', margin: '6px 0 0 0' }}>
                  RD$ {gastosMes.toLocaleString()}
                </h3>
              </div>

              {/* Ganancia Neta Real (Destacado) */}
              <div style={{ backgroundColor: '#141414', border: '2px solid #FFB800', borderRadius: '8px', padding: '16px' }}>
                <span style={{ fontSize: '10px', color: '#FFB800', fontWeight: 'bold', textTransform: 'uppercase' }}>GANANCIA NETA REAL (MES)</span>
                <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#FFB800', margin: '6px 0 0 0' }}>
                  RD$ {gananciaNetaMes.toLocaleString()}
                </h3>
              </div>

              {/* Pedidos Activos */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '8px', padding: '16px' }}>
                <span style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>PEDIDOS ACTIVOS</span>
                <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#00D2FF', margin: '6px 0 0 0' }}>
                  {pedidosActivos} <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>órdenes</span>
                </h3>
              </div>

              {/* Pendientes */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '8px', padding: '16px' }}>
                <span style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>PENDIENTES</span>
                <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#FFB800', margin: '6px 0 0 0' }}>
                  {pedidosPendientes}
                </h3>
              </div>

              {/* Tasa de Completación */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '8px', padding: '16px' }}>
                <span style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>TASA DE COMPLETACIÓN</span>
                <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#9B51E0', margin: '6px 0 0 0' }}>
                  {tasaCompletacion}%
                </h3>
              </div>

            </div>

            {/* SECCIÓN 3: RANKING DE PRODUCTOS MÁS RENTABLES */}
            <div style={{ backgroundColor: '#121212', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: '#FFB800', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏆 Ranking de Productos Más Rentables ({mesSeleccionado})
              </h2>

              {rankingProductos.length === 0 ? (
                <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>No hay ventas registradas para este mes.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rankingProductos.map((prod, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#181818', padding: '12px 16px', borderRadius: '6px', border: '1px solid #252525' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: index === 0 ? '#FFB800' : '#888' }}>
                          #{index + 1}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#FFF' }}>{prod.nombre}</span>
                        <span style={{ fontSize: '11px', color: '#666', backgroundColor: '#222', padding: '2px 8px', borderRadius: '10px' }}>
                          ({prod.cantidad} {prod.cantidad === 1 ? 'venta' : 'ventas'})
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '900', color: '#25D366' }}>
                        RD$ {prod.total.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECCIÓN 4: INGRESOS POR ZONA DE ENVÍO */}
            <div style={{ backgroundColor: '#121212', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: '#FFB800', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📍 Desglose de Ingresos por Zona de Envío ({mesSeleccionado})
              </h2>

              {Object.keys(ingresosPorZona).length === 0 ? (
                <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>No hay ingresos por zonas registrados en este período.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {Object.entries(ingresosPorZona).map(([zona, monto], index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#181818', padding: '12px 16px', borderRadius: '6px', border: '1px solid #252525' }}>
                      <span style={{ fontSize: '13px', color: '#DDD' }}>{zona}</span>
                      <span style={{ fontSize: '13px', fontWeight: '900', color: '#25D366' }}>
                        RD$ {monto.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
