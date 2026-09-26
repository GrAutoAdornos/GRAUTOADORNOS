// pages/admin/metricas.js
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function MetricasAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mesSeleccionado, setMesSeleccionado] = useState(obtenerMesActual());

  // Métricas Principales
  const [metricasActuales, setMetricasActuales] = useState({
    ventasTotales: 0,
    costoProductosVendidos: 0,
    totalInstalaciones: 0,
    totalEnvios: 0,
    gananciaNeta: 0,
    cantidadOrdenes: 0
  });

  const [metricasAnteriores, setMetricasAnteriores] = useState({
    ventasTotales: 0,
    costoProductosVendidos: 0,
    totalInstalaciones: 0,
    totalEnvios: 0,
    gananciaNeta: 0,
    cantidadOrdenes: 0
  });

  const [capitalInvertidoTotal, setCapitalInvertidoTotal] = useState(0);

  // Estado para el desglosado de ventas brutas
  const [pedidosDesglose, setPedidosDesglose] = useState([]);
  const [mostrarDesgloseVentas, setMostrarDesgloseVentas] = useState(false);

  function obtenerMesActual() {
    const hoy = new Date();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const yyyy = hoy.getFullYear();
    return `${yyyy}-${mm}`;
  }

  const calcularTotalesPorMes = useCallback((pedidos, claveMes, mapaProductos) => {
    let ventasTotales = 0;
    let costoProductosVendidos = 0;
    let totalInstalaciones = 0;
    let totalEnvios = 0;
    let cantidadOrdenes = 0;
    let listaPedidosDesglose = [];

    pedidos.forEach((p) => {
      let fechaPedido = p.fecha ? (p.fecha.toDate ? p.fecha.toDate() : new Date(p.fecha)) : new Date();
      const mesPedido = `${fechaPedido.getFullYear()}-${String(fechaPedido.getMonth() + 1).padStart(2, '0')}`;

      if (mesPedido === claveMes) {
        cantidadOrdenes++;
        const totalOrden = Number(p.total ?? 0);
        ventasTotales += totalOrden;

        const detalles = String(p.detalles || p.productos || '');
        let costoInstalacionOrden = Number(p.costoInstalacion ?? p.instalacion ?? 0);
        let costoEnvioOrden = Number(p.costoEnvio ?? p.envio ?? 0);

        // Guardar para el desglose detallado
        listaPedidosDesglose.push({
          idOrden: p.id ? p.id.substring(0, 8) : 'ORDEN',
          cliente: p.cliente || p.nombre || 'Cliente General',
          fecha: fechaPedido.toLocaleDateString('es-DO'),
          monto: totalOrden
        });

        // Extracción de Instalación por Unidad
        if (costoInstalacionOrden === 0 && detalles.toLowerCase().includes('instalación')) {
          Object.keys(mapaProductos).forEach((nombreProd) => {
            if (detalles.includes(nombreProd)) {
              const regex = new RegExp(`${nombreProd.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\(x(\\d+)\\)`, 'i');
              const match = detalles.match(regex);
              const cant = match ? parseInt(match[1], 10) : 1;
              const tarifaProd = mapaProductos[nombreProd]?.precioInstalacion ?? 100;

              costoInstalacionOrden += (tarifaProd * cant);
            }
          });
        }

        // Extracción de Envíos
        if (costoEnvioOrden === 0) {
          const textoMin = detalles.toLowerCase();
          if (textoMin.includes('distrito nacional')) costoEnvioOrden = 250;
          else if (textoMin.includes('santo domingo')) costoEnvioOrden = 350;
          else if (textoMin.includes('envío') || textoMin.includes('envio') || textoMin.includes('domicilio')) costoEnvioOrden = 300;
        }

        totalInstalaciones += costoInstalacionOrden;
        totalEnvios += costoEnvioOrden;

        // Costo de Productos (Capital Recuperado)
        let costoProdEnOrden = 0;
        Object.keys(mapaProductos).forEach((nombreProd) => {
          if (detalles.includes(nombreProd)) {
            const regex = new RegExp(`${nombreProd.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\(x(\\d+)\\)`, 'i');
            const match = detalles.match(regex);
            const cant = match ? parseInt(match[1], 10) : 1;

            costoProdEnOrden += (mapaProductos[nombreProd].costo * cant);
          }
        });

        if (costoProdEnOrden === 0) {
          const netoProd = Math.max(0, totalOrden - costoEnvioOrden - costoInstalacionOrden);
          costoProdEnOrden = netoProd * 0.5;
        }

        costoProductosVendidos += costoProdEnOrden;
      }
    });

    const gananciaNeta = ventasTotales - costoProductosVendidos - totalInstalaciones - totalEnvios;

    return {
      ventasTotales,
      costoProductosVendidos,
      totalInstalaciones,
      totalEnvios,
      gananciaNeta,
      cantidadOrdenes,
      listaPedidosDesglose
    };
  }, []);

  const cargarContabilidad = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Cargar productos para mapa de costos
      const snapProds = await getDocs(collection(db, 'productos'));
      const mapaProductos = {};
      let totalCapitalInventario = 0;

      snapProds.forEach((doc) => {
        const p = doc.data();
        const costoUnitario = Number(p.costo ?? (p.precio ? p.precio * 0.5 : 0));
        const stockActual = Number(p.stock ?? 0);
        const tarifaInstalacion = Number(p.precioInstalacion ?? p.costoInstalacion ?? p.instalacionPrecio ?? 100);

        mapaProductos[p.nombre] = {
          precio: Number(p.precio ?? 0),
          costo: costoUnitario,
          precioInstalacion: tarifaInstalacion
        };

        totalCapitalInventario += (stockActual * costoUnitario);
      });

      setCapitalInvertidoTotal(totalCapitalInventario);

      // 2. Cargar todos los pedidos
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      const pedidos = [];
      snapPedidos.forEach((doc) => pedidos.push({ id: doc.id, ...doc.data() }));

      // 3. Determinar Mes Anterior
      const [yearStr, monthStr] = mesSeleccionado.split('-');
      const fechaSel = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);

      const fechaAnt = new Date(fechaSel);
      fechaAnt.setMonth(fechaAnt.getMonth() - 1);
      const mesAnteriorStr = `${fechaAnt.getFullYear()}-${String(fechaAnt.getMonth() + 1).padStart(2, '0')}`;

      // 4. Calcular métricas
      const actual = calcularTotalesPorMes(pedidos, mesSeleccionado, mapaProductos);
      const anterior = calcularTotalesPorMes(pedidos, mesAnteriorStr, mapaProductos);

      setMetricasActuales(actual);
      setMetricasAnteriores(anterior);
      setPedidosDesglose(actual.listaPedidosDesglose || []);

    } catch (error) {
      console.error("Error al procesar métricas contables:", error);
    } finally {
      setLoading(false);
    }
  }, [mesSeleccionado, calcularTotalesPorMes]);

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) {
      router.push('/admin/login');
      return;
    }
    cargarContabilidad();
  }, [cargarContabilidad, router]);

  const calcularVariacion = (actual = 0, anterior = 0) => {
    if (!anterior || anterior === 0) return actual > 0 ? '+100%' : '0%';
    const diff = ((actual - anterior) / anterior) * 100;
    const signo = diff >= 0 ? '+' : '';
    return `${signo}${diff.toFixed(1)}%`;
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>CONTABILIDAD & MÉTRICAS</span></span>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>
            Volver al Panel
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '25px 20px' }}>

        {/* FILTRO POR MES */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141414', padding: '15px 20px', borderRadius: '10px', marginBottom: '25px', border: '1px solid #222', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Seleccionar Período Mes</h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Compara tus ganancias y pagos con el mes anterior</p>
          </div>
          <input
            type="month"
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
            style={{ backgroundColor: '#000', color: '#FFF', border: '1px solid #E50914', padding: '8px 12px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
          />
        </div>

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>Calculando finanzas...</p>
        ) : (
          <>
            {/* TARJETAS PRINCIPALES (KPIs) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px', marginBottom: '25px' }}>

              {/* Ventas Totales con Botón de Desglose */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold' }}>Ventas Totales Brutas</span>
                  <button
                    onClick={() => setMostrarDesgloseVentas(!mostrarDesgloseVentas)}
                    style={{ background: '#222', color: '#FFB800', border: '1px solid #FFB800', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {mostrarDesgloseVentas ? 'Ocultar' : '🔍 Ver Desglose'}
                  </button>
                </div>
                <h2 style={{ fontSize: '24px', color: '#FFF', margin: '8px 0' }}>RD$ {(metricasActuales.ventasTotales || 0).toLocaleString()}</h2>
                <span style={{ fontSize: '12px', color: (metricasActuales.ventasTotales >= metricasAnteriores.ventasTotales) ? '#25D366' : '#FF4D4D', fontWeight: 'bold' }}>
                  {calcularVariacion(metricasActuales.ventasTotales, metricasAnteriores.ventasTotales)} <span style={{ color: '#666', fontWeight: 'normal' }}>vs mes anterior</span>
                </span>
              </div>

              {/* Ganancia Neta */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #25D366', borderRadius: '10px', padding: '18px' }}>
                <span style={{ fontSize: '11px', color: '#25D366', textTransform: 'uppercase', fontWeight: 'bold' }}>Ganancia Neta Limpia</span>
                <h2 style={{ fontSize: '24px', color: '#25D366', margin: '8px 0' }}>RD$ {(metricasActuales.gananciaNeta || 0).toLocaleString()}</h2>
                <span style={{ fontSize: '12px', color: (metricasActuales.gananciaNeta >= metricasAnteriores.gananciaNeta) ? '#25D366' : '#FF4D4D', fontWeight: 'bold' }}>
                  {calcularVariacion(metricasActuales.gananciaNeta, metricasAnteriores.gananciaNeta)} <span style={{ color: '#666', fontWeight: 'normal' }}>vs mes anterior</span>
                </span>
              </div>

              {/* Pago a Técnico (Instalaciones) - ENLACE AL DESGLOSE */}
              <Link href={`/admin/desglose-tecnico?mes=${mesSeleccionado}`} style={{ textDecoration: 'none' }}>
                <div style={{ backgroundColor: '#141414', border: '1px solid #FFB800', borderRadius: '10px', padding: '18px', cursor: 'pointer', height: '100%' }}>
                  <span style={{ fontSize: '11px', color: '#FFB800', textTransform: 'uppercase', fontWeight: 'bold' }}>🔧 Por Pagar a Técnico</span>
                  <h2 style={{ fontSize: '24px', color: '#FFB800', margin: '8px 0' }}>RD$ {(metricasActuales.totalInstalaciones || 0).toLocaleString()}</h2>
                  <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>Total instalaciones del mes ↗ (Ver Desglose)</p>
                </div>
              </Link>

              {/* Pago a Transportista (Envíos) - ENLACE AL DESGLOSE */}
              <Link href={`/admin/desglose-transportista?mes=${mesSeleccionado}`} style={{ textDecoration: 'none' }}>
                <div style={{ backgroundColor: '#141414', border: '1px solid #3182CE', borderRadius: '10px', padding: '18px', cursor: 'pointer', height: '100%' }}>
                  <span style={{ fontSize: '11px', color: '#3182CE', textTransform: 'uppercase', fontWeight: 'bold' }}>🚚 Por Pagar a Transportista</span>
                  <h2 style={{ fontSize: '24px', color: '#3182CE', margin: '8px 0' }}>RD$ {(metricasActuales.totalEnvios || 0).toLocaleString()}</h2>
                  <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>Total fletes/envíos del mes ↗ (Ver Desglose)</p>
                </div>
              </Link>

            </div>

            {/* TABLA DE DESGLOSE DE VENTAS BRUTAS (Aparece al hacer clic en "Ver Desglose") */}
            {mostrarDesgloseVentas && (
              <div style={{ backgroundColor: '#141414', border: '1px solid #FFB800', borderRadius: '10px', padding: '20px', marginBottom: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#FFB800' }}>
                    📋 Desglose Individual de Ventas Brutas ({mesSeleccionado})
                  </h4>
                  <span style={{ fontSize: '12px', color: '#888' }}>{pedidosDesglose.length} pedidos en total</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333', textAlign: 'left', color: '#AAA' }}>
                      <th style={{ padding: '8px' }}>Fecha</th>
                      <th style={{ padding: '8px' }}>Orden ID</th>
                      <th style={{ padding: '8px' }}>Cliente</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Monto Bruto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosDesglose.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '15px', textAlign: 'center', color: '#888' }}>No hay ventas registradas en este mes.</td>
                      </tr>
                    ) : (
                      pedidosDesglose.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '8px' }}>{item.fecha}</td>
                          <td style={{ padding: '8px', color: '#FFB800' }}>#{item.idOrden}</td>
                          <td style={{ padding: '8px' }}>{item.cliente}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>RD$ {item.monto.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #FFB800', fontWeight: 'bold' }}>
                      <td colSpan="3" style={{ padding: '12px 8px', textAlign: 'right' }}>SUMA TOTAL VENTAS BRUTAS:</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#FFB800', fontSize: '16px' }}>
                        RD$ {(metricasActuales.ventasTotales || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* BALANCE DETALLADO Y CAPITAL */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>

              {/* Comparativa Mensual */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #222', paddingBottom: '10px', color: '#E50914' }}>
                  📊 Comparativa Contable Mensual
                </h4>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1F1F1F', fontSize: '13px' }}>
                  <span style={{ color: '#AAA' }}>Órdenes Procesadas:</span>
                  <strong>{metricasActuales.cantidadOrdenes || 0} pedidos</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1F1F1F', fontSize: '13px' }}>
                  <span style={{ color: '#AAA' }}>Costo Prod. Vendidos (Capital Recuperado):</span>
                  <span style={{ color: '#FF4D4D' }}>RD$ {(metricasActuales.costoProductosVendidos || 0).toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1F1F1F', fontSize: '13px' }}>
                  <span style={{ color: '#AAA' }}>Ganancia Mes Anterior:</span>
                  <span>RD$ {(metricasAnteriores.gananciaNeta || 0).toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0 0', fontSize: '14px' }}>
                  <strong>Crecimiento Ganancias:</strong>
                  <strong style={{ color: (metricasActuales.gananciaNeta >= metricasAnteriores.gananciaNeta) ? '#25D366' : '#FF4D4D' }}>
                    {calcularVariacion(metricasActuales.gananciaNeta, metricasAnteriores.gananciaNeta)}
                  </strong>
                </div>
              </div>

              {/* Capital Actual en Almacén */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #222', paddingBottom: '10px', color: '#FFF' }}>
                  🏢 Capital Invertido Actual (Almacén)
                </h4>

                <p style={{ fontSize: '12px', color: '#888', margin: '0 0 15px 0' }}>
                  Valor total del dinero retenido en mercancía en inventario disponible.
                </p>

                <div style={{ backgroundColor: '#0D0D0D', padding: '15px', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Valor Total de Mercancía</span>
                  <h2 style={{ fontSize: '26px', color: '#FFF', margin: '5px 0' }}>RD$ {(capitalInvertidoTotal || 0).toLocaleString()}</h2>
                </div>
              </div>

            </div>
          </>
        )}
      </main>
    </div>
  );
}
