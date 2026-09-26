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
    ingresoProductos: 0,
    costoProductosVendidos: 0,
    totalInstalaciones: 0,
    totalEnvios: 0,
    gananciaNeta: 0,
    cantidadOrdenes: 0,
    promedioPorPedido: 0
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

        const netoProductoOrden = Math.max(0, totalOrden - costoEnvioOrden - costoInstalacionOrden);

        listaPedidosDesglose.push({
          idOrden: p.id ? p.id.substring(0, 8) : 'ORDEN',
          cliente: p.cliente || p.nombre || 'Cliente General',
          fecha: fechaPedido.toLocaleDateString('es-DO'),
          montoProducto: netoProductoOrden,
          montoInstalacion: costoInstalacionOrden,
          montoEnvio: costoEnvioOrden,
          montoTotal: totalOrden
        });

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
          costoProdEnOrden = netoProductoOrden * 0.5;
        }

        costoProductosVendidos += costoProdEnOrden;
      }
    });

    const ingresoProductos = ventasTotales - totalInstalaciones - totalEnvios;
    const gananciaNeta = ingresoProductos - costoProductosVendidos;
    const promedioPorPedido = cantidadOrdenes > 0 ? (ventasTotales / cantidadOrdenes) : 0;

    return {
      ventasTotales,
      ingresoProductos,
      costoProductosVendidos,
      totalInstalaciones,
      totalEnvios,
      gananciaNeta,
      cantidadOrdenes,
      promedioPorPedido,
      listaPedidosDesglose
    };
  }, []);

  const cargarContabilidad = useCallback(async () => {
    setLoading(true);
    try {
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

      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      const pedidos = [];
      snapPedidos.forEach((doc) => pedidos.push({ id: doc.id, ...doc.data() }));

      const [yearStr, monthStr] = mesSeleccionado.split('-');
      const fechaSel = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);

      const fechaAnt = new Date(fechaSel);
      fechaAnt.setMonth(fechaAnt.getMonth() - 1);
      const mesAnteriorStr = `${fechaAnt.getFullYear()}-${String(fechaAnt.getMonth() + 1).padStart(2, '0')}`;

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

  // Cálculo porcentual para barras visuales
  const maxVentaGrafico = Math.max(metricasActuales.ventasTotales, metricasAnteriores.ventasTotales, 1);
  const porcentajeBarraActual = Math.min(100, (metricasActuales.ventasTotales / maxVentaGrafico) * 100);
  const porcentajeBarraAnterior = Math.min(100, (metricasAnteriores.ventasTotales / maxVentaGrafico) * 100);

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

              {/* Dinero Total Entrado */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold' }}>💵 Dinero Total Entrado</span>
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

              {/* Ganancia Limpia */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #25D366', borderRadius: '10px', padding: '18px' }}>
                <span style={{ fontSize: '11px', color: '#25D366', textTransform: 'uppercase', fontWeight: 'bold' }}>🤑 Ganancia Limpia (Tuya)</span>
                <h2 style={{ fontSize: '24px', color: '#25D366', margin: '8px 0' }}>RD$ {(metricasActuales.gananciaNeta || 0).toLocaleString()}</h2>
                <span style={{ fontSize: '12px', color: (metricasActuales.gananciaNeta >= metricasAnteriores.gananciaNeta) ? '#25D366' : '#FF4D4D', fontWeight: 'bold' }}>
                  {calcularVariacion(metricasActuales.gananciaNeta, metricasAnteriores.gananciaNeta)} <span style={{ color: '#666', fontWeight: 'normal' }}>vs mes anterior</span>
                </span>
              </div>

              {/* Pago a Técnico */}
              <Link href={`/admin/desglose-tecnico?mes=${mesSeleccionado}`} style={{ textDecoration: 'none' }}>
                <div style={{ backgroundColor: '#141414', border: '1px solid #FFB800', borderRadius: '10px', padding: '18px', cursor: 'pointer', height: '100%' }}>
                  <span style={{ fontSize: '11px', color: '#FFB800', textTransform: 'uppercase', fontWeight: 'bold' }}>🔧 Por Pagar a Técnico</span>
                  <h2 style={{ fontSize: '24px', color: '#FFB800', margin: '8px 0' }}>RD$ {(metricasActuales.totalInstalaciones || 0).toLocaleString()}</h2>
                  <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>Total instalaciones del mes ↗ (Ver Recibo)</p>
                </div>
              </Link>

              {/* Pago a Transportista */}
              <Link href={`/admin/desglose-transportista?mes=${mesSeleccionado}`} style={{ textDecoration: 'none' }}>
                <div style={{ backgroundColor: '#141414', border: '1px solid #3182CE', borderRadius: '10px', padding: '18px', cursor: 'pointer', height: '100%' }}>
                  <span style={{ fontSize: '11px', color: '#3182CE', textTransform: 'uppercase', fontWeight: 'bold' }}>🚚 Por Pagar a Transportista</span>
                  <h2 style={{ fontSize: '24px', color: '#3182CE', margin: '8px 0' }}>RD$ {(metricasActuales.totalEnvios || 0).toLocaleString()}</h2>
                  <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>Total fletes/envíos del mes ↗ (Ver Recibo)</p>
                </div>
              </Link>

            </div>

            {/* 📊 GRÁFICO VISUAL DE BARRAS (COMPARATIVA MENSUAL) */}
            <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px', marginBottom: '25px' }}>
              <h4 style={{ margin: '0 0 5px 0', fontSize: '16px', color: '#FFF' }}>
                📊 Gráfico Visual de Ventas: Este Mes vs Mes Anterior
              </h4>
              <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#888' }}>
                Comparación directa del rendimiento general de ingresos entre ambos períodos.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {/* Barra Mes Seleccionado */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                    <span style={{ color: '#FFB800', fontWeight: 'bold' }}>Mes Actual ({mesSeleccionado})</span>
                    <strong style={{ color: '#FFF' }}>RD$ {(metricasActuales.ventasTotales || 0).toLocaleString()}</strong>
                  </div>
                  <div style={{ width: '100%', backgroundColor: '#222', height: '16px', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${porcentajeBarraActual}%`, backgroundColor: '#E50914', height: '100%', borderRadius: '8px', transition: 'width 0.5s ease' }}></div>
                  </div>
                </div>

                {/* Barra Mes Anterior */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                    <span style={{ color: '#888' }}>Mes Anterior</span>
                    <strong style={{ color: '#AAA' }}>RD$ {(metricasAnteriores.ventasTotales || 0).toLocaleString()}</strong>
                  </div>
                  <div style={{ width: '100%', backgroundColor: '#222', height: '16px', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${porcentajeBarraAnterior}%`, backgroundColor: '#444', height: '100%', borderRadius: '8px', transition: 'width 0.5s ease' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* TABLA DE DESGLOSE INTERACTIVO Y SENCILLO */}
            {mostrarDesgloseVentas && (
              <div style={{ backgroundColor: '#141414', border: '1px solid #FFB800', borderRadius: '10px', padding: '20px', marginBottom: '25px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#FFB800' }}>
                    📋 Auditoría de Ventas Brutas ({mesSeleccionado})
                  </h4>
                  <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#AAA' }}>
                    Aquí ves exactamente cómo se divide cada peso que pagó el cliente:
                  </p>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #333', textAlign: 'left', color: '#AAA' }}>
                        <th style={{ padding: '8px' }}>Fecha</th>
                        <th style={{ padding: '8px' }}>Orden</th>
                        <th style={{ padding: '8px' }}>Cliente</th>
                        <th style={{ padding: '8px', textAlign: 'right', color: '#FFF' }}>📦 Producto</th>
                        <th style={{ padding: '8px', textAlign: 'right', color: '#FFB800' }}>🔧 Técnico</th>
                        <th style={{ padding: '8px', textAlign: 'right', color: '#3182CE' }}>🚚 Envío</th>
                        <th style={{ padding: '8px', textAlign: 'right', color: '#25D366' }}>💰 Total Recibido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosDesglose.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ padding: '15px', textAlign: 'center', color: '#888' }}>No hay ventas registradas en este mes.</td>
                        </tr>
                      ) : (
                        pedidosDesglose.map((item, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                            <td style={{ padding: '8px' }}>{item.fecha}</td>
                            <td style={{ padding: '8px', color: '#FFB800' }}>#{item.idOrden}</td>
                            <td style={{ padding: '8px' }}>{item.cliente}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>RD$ {item.montoProducto.toLocaleString()}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: '#FFB800' }}>RD$ {item.montoInstalacion.toLocaleString()}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: '#3182CE' }}>RD$ {item.montoEnvio.toLocaleString()}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#25D366' }}>RD$ {item.montoTotal.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid #FFB800', fontWeight: 'bold', backgroundColor: '#0D0D0D' }}>
                        <td colSpan="3" style={{ padding: '12px 8px', textAlign: 'right' }}>SUMAS TOTALES:</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: '#FFF' }}>
                          RD$ {(metricasActuales.ingresoProductos || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: '#FFB800' }}>
                          RD$ {(metricasActuales.totalInstalaciones || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: '#3182CE' }}>
                          RD$ {(metricasActuales.totalEnvios || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: '#25D366', fontSize: '15px' }}>
                          RD$ {(metricasActuales.ventasTotales || 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#0D0D0D', borderRadius: '6px', border: '1px solid #222', fontSize: '12px', color: '#888' }}>
                  📌 <strong style={{ color: '#FFF' }}>Explicación sencilla:</strong> De los <strong style={{ color: '#25D366' }}>RD$ {(metricasActuales.ventasTotales || 0).toLocaleString()}</strong> cobrados en total:
                  <span style={{ color: '#FFF' }}> RD$ {(metricasActuales.ingresoProductos || 0).toLocaleString()}</span> correspondieron a la venta de mercancía,
                  <span style={{ color: '#FFB800' }}> RD$ {(metricasActuales.totalInstalaciones || 0).toLocaleString()}</span> son para saldar al instalador y
                  <span style={{ color: '#3182CE' }}> RD$ {(metricasActuales.totalEnvios || 0).toLocaleString()}</span> corresponden al transportista.
                </div>
              </div>
            )}

            {/* BALANCE EXPLICADO PASO A PASO (SIN ENREDOS CONTABLES) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>

              {/* ¿De dónde sale tu dinero? */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #222', paddingBottom: '10px', color: '#25D366' }}>
                  💡 ¿Cómo se calcula tu Ganancia Limpia?
                </h4>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1F1F1F', fontSize: '13px' }}>
                  <span style={{ color: '#AAA' }}>📦 Cobrado por Productos (Sin envíos ni instalaciones):</span>
                  <strong style={{ color: '#FFF' }}>RD$ {(metricasActuales.ingresoProductos || 0).toLocaleString()}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1F1F1F', fontSize: '13px' }}>
                  <span style={{ color: '#AAA' }}>🔴 Menos el Costo Real de esa Mercancía:</span>
                  <strong style={{ color: '#FF4D4D' }}>- RD$ {(metricasActuales.costoProductosVendidos || 0).toLocaleString()}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 5px 0', fontSize: '14px', backgroundColor: '#0D0D0D', margin: '10px -10px -10px -10px', padding: '12px 10px', borderRadius: '6px' }}>
                  <span style={{ color: '#25D366', fontWeight: 'bold' }}>🟢 Ganancia Real (Limpia para ti):</span>
                  <strong style={{ color: '#25D366', fontSize: '16px' }}>RD$ {(metricasActuales.gananciaNeta || 0).toLocaleString()}</strong>
                </div>

                <div style={{ marginTop: '15px', borderTop: '1px solid #222', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888' }}>
                  <span>Ganancia del Mes Anterior:</span>
                  <span style={{ color: '#FFF' }}>RD$ {(metricasAnteriores.gananciaNeta || 0).toLocaleString()}</span>
                </div>

                <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888' }}>
                  <span>Crecimiento de Tu Negocio:</span>
                  <strong style={{ color: (metricasActuales.gananciaNeta >= metricasAnteriores.gananciaNeta) ? '#25D366' : '#FF4D4D' }}>
                    {calcularVariacion(metricasActuales.gananciaNeta, metricasAnteriores.gananciaNeta)}
                  </strong>
                </div>
              </div>

              {/* MÁSFÁCIL PARA TI: DATOS DE CONTROL RÁPIDO */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #222', paddingBottom: '10px', color: '#FFF' }}>
                    📈 Resumen Rápido para el Dueño
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div style={{ backgroundColor: '#0D0D0D', padding: '12px', borderRadius: '8px', border: '1px solid #222' }}>
                      <span style={{ fontSize: '11px', color: '#888' }}>Venta Promedio por Cliente</span>
                      <h4 style={{ margin: '5px 0 0 0', color: '#FFF', fontSize: '15px' }}>
                        RD$ {(metricasActuales.promedioPorPedido || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </h4>
                    </div>
                    <div style={{ backgroundColor: '#0D0D0D', padding: '12px', borderRadius: '8px', border: '1px solid #222' }}>
                      <span style={{ fontSize: '11px', color: '#888' }}>Total Venta de Pedidos</span>
                      <h4 style={{ margin: '5px 0 0 0', color: '#25D366', fontSize: '15px' }}>
                        {metricasActuales.cantidadOrdenes || 0} órdenes
                      </h4>
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#0D0D0D', padding: '15px', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>🏢 Mercancía Invertida en Almacén</span>
                  <h2 style={{ fontSize: '24px', color: '#FFF', margin: '5px 0' }}>RD$ {(capitalInvertidoTotal || 0).toLocaleString()}</h2>
                  <span style={{ fontSize: '11px', color: '#666' }}>Dinero guardado actualmente en stock</span>
                </div>
              </div>

            </div>
          </>
        )}
      </main>
    </div>
  );
}
