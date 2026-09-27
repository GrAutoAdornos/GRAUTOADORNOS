import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AnaliticasDashboard() {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);

  // Métricas financieras calculadas (Solo completados)
  const [ventasTotales, setVentasTotales] = useState(0);
  const [ventasDiarias, setVentasDiarias] = useState(0);
  const [ventasSemanales, setVentasSemanales] = useState(0);
  const [ventasMensuales, setVentasMensuales] = useState(0);

  // Métricas operativas y de estado
  const [ventasPendientes, setVentasPendientes] = useState(0);
  const [pedidosPendientesCount, setPedidosPendientesCount] = useState(0);
  const [ticketPromedio, setTicketPromedio] = useState(0);
  const [totalPedidosCompletadosCount, setTotalPedidosCompletadosCount] = useState(0);

  // Métricas por Canal y Citas
  const [metricasCanal, setMetricasCanal] = useState({ web: 0, whatsapp: 0, pctWeb: 0, pctWhatsapp: 0 });
  const [metricasCitas, setMetricasCitas] = useState({ totalHistoricas: 0, citasEsteSabado: 0 });

  // Rankings y listas
  const [productosMasVendidos, setProductosMasVendidos] = useState([]);
  const [ingresosPorZona, setIngresosPorZona] = useState({});
  const [topClientes, setTopClientes] = useState([]);
  const [productosStockBajo, setProductosStockBajo] = useState([]);

  useEffect(() => {
    cargarDatosAnalitica();
  }, []);

  const cargarDatosAnalitica = async () => {
    try {
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

      // 3. Procesar Métricas
      calcularMetricas(listaPedidos, listaProductos);

    } catch (error) {
      console.error("Error al cargar datos para analíticas:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calcula el monto neto real de un pedido teniendo en cuenta
   * subtotal, descuento, envío o total guardado.
   */
  const obtenerMontoNeto = (p) => {
    if (p.totalNeto !== undefined && !isNaN(Number(p.totalNeto))) {
      return Number(p.totalNeto);
    }

    const subtotal = Number(p.subtotal || 0);
    const descuento = Number(p.descuento || p.discount || 0);
    const envio = Number(p.costoEnvio || p.envio || 0);

    if (subtotal > 0) {
      return Math.max(0, subtotal - descuento + envio);
    }

    return Number(p.total || 0);
  };

  const calcularMetricas = (listaPedidos, listaProductos) => {
    let tTotal = 0;
    let tDiario = 0;
    let tSemanal = 0;
    let tMensual = 0;
    let countCompletados = 0;

    let tPendiente = 0;
    let countPendientes = 0;

    // Métricas por canal
    let countWeb = 0;
    let countWhatsapp = 0;

    // Métricas por citas
    let countCitasTotales = 0;
    let countCitasEsteSabado = 0;

    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    
    // Calcular la fecha del próximo sábado
    const proximoSabado = new Date(ahora);
    const diasHastaSabado = (6 - proximoSabado.getDay() + 7) % 7;
    proximoSabado.setDate(proximoSabado.getDate() + (diasHastaSabado === 0 && ahora.getDay() !== 6 ? 7 : diasHastaSabado));
    const strProximoSabado = proximoSabado.toISOString().split('T')[0];

    // Hace 7 días
    const hace7Dias = new Date();
    hace7Dias.setDate(ahora.getDate() - 7);

    // Mes y año actual
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    // Contadores auxiliares
    const prodConteo = {};
    const zonaConteo = {};
    const clientesMap = {};

    listaPedidos.forEach((p) => {
      const montoNeto = obtenerMontoNeto(p);
      const estadoNormalizado = (p.estado || '').toString().trim().toLowerCase();

      const esCompletado = ['completado', 'entregado', 'enviado'].includes(estadoNormalizado);
      const esPendiente = ['pendiente', 'en proceso', 'por pagar', 'procesando'].includes(estadoNormalizado);

      // --- 0. PROCESAR CANALES Y CITAS (Aplica a todos los pedidos) ---
      const esManualOWhatsApp = p.esManual || p.origenWhatsApp || p.canal === 'whatsapp' || p.origen === 'whatsapp';
      if (esManualOWhatsApp) {
        countWhatsapp += 1;
      } else {
        countWeb += 1;
      }

      if (p.requiereInstalacion || p.fechaCita || p.horaCita) {
        countCitasTotales += 1;
        if (p.fechaCita === strProximoSabado) {
          countCitasEsteSabado += 1;
        }
      }

      // 1. EXTRAER CLIENTE CON MULTIPLES FALLBACKS
      const rawNombre = p.nombre || p.cliente || p.clienteNombre || p.nombreCliente || p.email || '';
      const rawTelefono = p.telefono || p.clienteTelefono || p.phone || '';

      const nombreLimpio = rawNombre.toString().trim();
      const telefonoLimpio = rawTelefono.toString().trim();

      const nombreMostrar = nombreLimpio || (telefonoLimpio ? `Cliente (${telefonoLimpio})` : 'Cliente Anónimo');

      let clienteKey = 'anonimo';
      if (telefonoLimpio) {
        clienteKey = `tel_${telefonoLimpio}`;
      } else if (nombreLimpio) {
        clienteKey = `nom_${nombreLimpio.toLowerCase()}`;
      } else {
        clienteKey = `order_${p.id}`;
      }

      if (!clientesMap[clienteKey]) {
        clientesMap[clienteKey] = {
          nombre: nombreMostrar,
          telefono: telefonoLimpio,
          totalGastado: 0,
          pedidosCount: 0
        };
      }

      // 2. CÁLCULOS FINANCIEROS REALES (Solo órdenes COMPLETADAS)
      if (esCompletado) {
        countCompletados += 1;
        tTotal += montoNeto;

        // Acumular gasto del cliente
        clientesMap[clienteKey].totalGastado += montoNeto;
        clientesMap[clienteKey].pedidosCount += 1;

        // Procesar fecha del pedido
        let fechaPedido = ahora;
        if (p.fecha?.toDate) {
          fechaPedido = p.fecha.toDate();
        } else if (p.fecha) {
          fechaPedido = new Date(p.fecha);
        }

        const tiempoPedido = fechaPedido.getTime();

        // Diarias (hoy)
        if (tiempoPedido >= inicioHoy) {
          tDiario += montoNeto;
        }

        // Semanales (últimos 7 días)
        if (fechaPedido >= hace7Dias) {
          tSemanal += montoNeto;
        }

        // Mensuales (mes actual)
        if (fechaPedido.getMonth() === mesActual && fechaPedido.getFullYear() === anioActual) {
          tMensual += montoNeto;
        }

        // Conteo por Zonas de Envío
        const zona = p.zonaEnvio || p.direccion || 'No especificada';
        zonaConteo[zona] = (zonaConteo[zona] || 0) + montoNeto;

        // Conteo de Productos más vendidos
        if (p.productosDetalle && Array.isArray(p.productosDetalle)) {
          p.productosDetalle.forEach((item) => {
            const nombreProd = item.nombre || item.titulo || 'Producto sin nombre';
            const cantidad = Number(item.cantidad || item.qty || item.count || 1);
            prodConteo[nombreProd] = (prodConteo[nombreProd] || 0) + cantidad;
          });
        } else if (p.detalles) {
          const strDetalles = String(p.detalles);
          const items = strDetalles.split(',');
          items.forEach((it) => {
            const trimmed = it.trim();
            const matchCantidad1 = trimmed.match(/^(\d+)\s*x\s*(.+)$/i);
            const matchCantidad2 = trimmed.match(/^(.+)\s*x\s*(\d+)$/i);

            if (matchCantidad1) {
              const qty = Number(matchCantidad1[1] || 1);
              const name = matchCantidad1[2].trim();
              prodConteo[name] = (prodConteo[name] || 0) + qty;
            } else if (matchCantidad2) {
              const qty = Number(matchCantidad2[2] || 1);
              const name = matchCantidad2[1].trim();
              prodConteo[name] = (prodConteo[name] || 0) + qty;
            } else if (trimmed) {
              prodConteo[trimmed] = (prodConteo[trimmed] || 0) + 1;
            }
          });
        }
      } else if (esPendiente) {
        tPendiente += montoNeto;
        countPendientes += 1;
      }
    });

    setVentasTotales(tTotal);
    setVentasDiarias(tDiario);
    setVentasSemanales(tSemanal);
    setVentasMensuales(tMensual);
    setVentasPendientes(tPendiente);
    setPedidosPendientesCount(countPendientes);

    setTotalPedidosCompletadosCount(countCompletados);
    setTicketPromedio(countCompletados > 0 ? tTotal / countCompletados : 0);

    // Guardar Métricas de Canal
    const totalPedidosGbl = listaPedidos.length || 1;
    setMetricasCanal({
      web: countWeb,
      whatsapp: countWhatsapp,
      pctWeb: ((countWeb / totalPedidosGbl) * 100).toFixed(1),
      pctWhatsapp: ((countWhatsapp / totalPedidosGbl) * 100).toFixed(1)
    });

    // Guardar Métricas de Citas
    setMetricasCitas({
      totalHistoricas: countCitasTotales,
      citasEsteSabado: countCitasEsteSabado
    });

    // Ordenar productos más vendidos (Top 5)
    const productosOrdenados = Object.keys(prodConteo)
      .map((nombre) => ({ nombre, cantidad: prodConteo[nombre] }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
    setProductosMasVendidos(productosOrdenados);

    setIngresosPorZona(zonaConteo);

    // TOP 5 CLIENTES FRECUENTES
    const topClientesOrdenados = Object.values(clientesMap)
      .filter((c) => c.totalGastado > 0)
      .sort((a, b) => b.totalGastado - a.totalGastado)
      .slice(0, 5);
    setTopClientes(topClientesOrdenados);

    // INVENTARIO CRÍTICO (Bajo Stock <= 5 unidades)
    const productosBajos = listaProductos
      .map((prod) => ({
        id: prod.id,
        nombre: prod.nombre || prod.titulo || 'Sin nombre',
        stock: Number(prod.stock !== undefined ? prod.stock : (prod.cantidad || 0))
      }))
      .filter((prod) => prod.stock <= 5)
      .sort((a, b) => a.stock - b.stock);

    setProductosStockBajo(productosBajos);
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', padding: '30px 20px', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E50914', paddingBottom: '15px', marginBottom: '25px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#E50914', textTransform: 'uppercase', margin: 0 }}>
            📊 GR Analíticas & Reportes
          </h1>
          <p style={{ fontSize: '12px', color: '#888', margin: '4px 0 0 0' }}>Métricas reales basadas únicamente en órdenes completadas</p>
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
            
            {/* TARJETAS DE VENTAS REALES */}
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '12px' }}>💰 Resumen de Ventas Confirmadas (RD$)</h2>
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
                  <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Ingresos Acumulados</span>
                  <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#E50914', margin: '8px 0 0 0' }}>
                    RD$ {ventasTotales.toLocaleString()}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#666' }}>Órdenes completadas: {totalPedidosCompletadosCount}</span>
                </div>

              </div>
            </div>

            {/* TARJETAS DE OPERACIÓN */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
              <div style={{ backgroundColor: '#141414', border: '1px solid #332d18', borderRadius: '10px', padding: '18px' }}>
                <span style={{ fontSize: '12px', color: '#FFB800', textTransform: 'uppercase', fontWeight: 'bold' }}>⏳ Ventas Pendientes / Por Cobrar</span>
                <h3 style={{ fontSize: '22px', fontWeight: '900', color: '#FFB800', margin: '6px 0 0 0' }}>
                  RD$ {ventasPendientes.toLocaleString()}
                </h3>
                <span style={{ fontSize: '11px', color: '#888' }}>{pedidosPendientesCount} orden(es) en estado pendiente</span>
              </div>

              <div style={{ backgroundColor: '#141414', border: '1px solid #1f2b38', borderRadius: '10px', padding: '18px' }}>
                <span style={{ fontSize: '12px', color: '#00B0FF', textTransform: 'uppercase', fontWeight: 'bold' }}>🛒 Ticket Promedio</span>
                <h3 style={{ fontSize: '22px', fontWeight: '900', color: '#00B0FF', margin: '6px 0 0 0' }}>
                  RD$ {Math.round(ticketPromedio).toLocaleString()}
                </h3>
                <span style={{ fontSize: '11px', color: '#888' }}>Gasto promedio por cada orden completada</span>
              </div>
            </div>

            {/* SECCIÓN NUEVA: CANALES DE VENTA Y FRECUENCIA DE CITAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              
              {/* Tarjeta: Porcentaje de Conversión por Canal */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '15px' }}>
                  📊 Conversión por Canal de Venta
                </h2>
                
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span>🌐 Página Web Directa</span>
                    <span style={{ color: '#25D366', fontWeight: 'bold' }}>{metricasCanal.pctWeb}% ({metricasCanal.web})</span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: '#222', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${metricasCanal.pctWeb}%`, backgroundColor: '#25D366', height: '100%' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span>💬 Manual / WhatsApp</span>
                    <span style={{ color: '#E50914', fontWeight: 'bold' }}>{metricasCanal.pctWhatsapp}% ({metricasCanal.whatsapp})</span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: '#222', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${metricasCanal.pctWhatsapp}%`, backgroundColor: '#E50914', height: '100%' }}></div>
                  </div>
                </div>
              </div>

              {/* Tarjeta: Frecuencia de Citas / Instalaciones */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '15px' }}>
                  🔧 Ocupación de Taller / Instalaciones
                </h2>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <div>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#FFB800' }}>{metricasCitas.totalHistoricas}</p>
                    <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Citas Históricas Totales</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#FFF' }}>{metricasCitas.citasEsteSabado} / 2</p>
                    <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Cupos Próximo Sábado</p>
                  </div>
                </div>

                <div style={{ backgroundColor: '#1A1A1A', padding: '10px', borderRadius: '6px', fontSize: '11px', color: '#CCC', borderLeft: '3px solid #FFB800' }}>
                  💡 <b>Gestión de Taller:</b> Cada sábado cuenta con máximo 2 cupos de instalación (1:00 PM y 4:00 PM).
                </div>
              </div>

            </div>

            {/* SECCIÓN 2: PRODUCTOS MÁS VENDIDOS Y ZONAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '15px' }}>🔥 Productos con Mayor Rotación</h2>
                {productosMasVendidos.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>Aún no hay suficientes datos de productos vendidos.</p>
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
                        <span style={{ fontSize: '12px', color: '#25D366', fontWeight: 'bold' }}>{prod.cantidad} unid.</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '15px' }}>📍 Ingresos por Zonas de Envío</h2>
                {Object.keys(ingresosPorZona).length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>No hay registros de zonas de envío completadas.</p>
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

            {/* SECCIÓN 3: TOP CLIENTES Y ALERTAS DE STOCK */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '15px' }}>👥 Top 5 Clientes Frecuentes (VIP)</h2>
                {topClientes.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>Aún no hay compras completadas de clientes.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {topClientes.map((cliente, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1A1A', padding: '10px 12px', borderRadius: '6px', border: '1px solid #252525' }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 'bold', margin: 0 }}>{index + 1}. {cliente.nombre}</p>
                          <span style={{ fontSize: '11px', color: '#888' }}>{cliente.pedidosCount} orden(es) completada(s)</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#25D366' }}>
                          RD$ {cliente.totalGastado.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#E50914', marginBottom: '15px' }}>📉 Inventario Crítico (Bajo Stock)</h2>
                {productosStockBajo.length === 0 ? (
                  <p style={{ color: '#25D366', fontSize: '13px' }}>¡Excelente! Todos los productos tienen suficiente stock (&gt; 5 unidades).</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                    {productosStockBajo.map((prod) => (
                      <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1A1A', padding: '10px 12px', borderRadius: '6px', border: prod.stock === 0 ? '1px solid #E50914' : '1px solid #444' }}>
                        <span style={{ fontSize: '13px', color: '#FFF' }}>{prod.nombre}</span>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', backgroundColor: prod.stock === 0 ? '#E50914' : '#FFB800', color: '#000' }}>
                          {prod.stock === 0 ? 'AGOTADO' : `${prod.stock} disp.`}
                        </span>
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
