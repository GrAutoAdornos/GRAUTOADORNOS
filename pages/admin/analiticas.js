// pages/admin/analiticas.js
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AnaliticasDashboard() {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);

  // Métricas calculadas
  const [ventasTotales, setVentasTotales] = useState(0);
  const [ventasDiarias, setVentasDiarias] = useState(0);
  const [ventasSemanales, setVentasSemanales] = useState(0);
  const [ventasMensuales, setVentasMensuales] = useState(0);
  const [productosMasVendidos, setProductosMasVendidos] = useState([]);
  const [ingresosPorZona, setIngresosPorZona] = useState({});
  const [totalPedidosCount, setTotalPedidosCount] = useState(0);

  // NUEVAS MÉTRICAS: Top Clientes e Inventario Crítico
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
      setTotalPedidosCount(listaPedidos.length);

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

  const calcularMetricas = (listaPedidos, listaProductos) => {
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

    // Contadores auxiliares
    const prodConteo = {};
    const zonaConteo = {};
    const clientesMap = {};

    listaPedidos.forEach((p) => {
      const monto = Number(p.total || 0);
      
      // 1. EXTRAER CAMPOS CON MULTIPLES FALLBACKS
      const rawNombre = p.nombre || p.cliente || p.clienteNombre || p.nombreCliente || p.email || '';
      const rawTelefono = p.telefono || p.clienteTelefono || p.phone || '';

      // Limpiar datos
      const nombreLimpio = rawNombre.toString().trim();
      const telefonoLimpio = rawTelefono.toString().trim();

      // Definir nombre visible
      const nombreMostrar = nombreLimpio || (telefonoLimpio ? `Cliente (${telefonoLimpio})` : 'Cliente Anónimo');

      // Clave única para agrupar: Teléfono primero, luego nombre en minúsculas
      let clienteKey = 'anonimo';
      if (telefonoLimpio) {
        clienteKey = `tel_${telefonoLimpio}`;
      } else if (nombreLimpio) {
        clienteKey = `nom_${nombreLimpio.toLowerCase()}`;
      } else {
        clienteKey = `order_${p.id}`; // Si no tiene nada, no agrupar a todos en 'anonimo'
      }

      if (!clientesMap[clienteKey]) {
        clientesMap[clienteKey] = {
          nombre: nombreMostrar,
          telefono: telefonoLimpio,
          totalGastado: 0,
          pedidosCount: 0
        };
      }

      // Si el pedido no está cancelado, suma a las finanzas
      if (p.estado !== 'Cancelado') {
        tTotal += monto;

        // Acumular gasto del cliente
        clientesMap[clienteKey].totalGastado += monto;
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
          tDiario += monto;
        }

        // Semanales (últimos 7 días)
        if (fechaPedido >= hace7Dias) {
          tSemanal += monto;
        }

        // Mensuales (mes actual)
        if (fechaPedido.getMonth() === mesActual && fechaPedido.getFullYear() === anioActual) {
          tMensual += monto;
        }
      }

      // Conteo de Productos más vendidos
      if (p.productosDetalle && Array.isArray(p.productosDetalle)) {
        p.productosDetalle.forEach((item) => {
          const nombreProd = item.nombre || 'Producto sin nombre';
          const cantidad = Number(item.cantidad || 1);
          prodConteo[nombreProd] = (prodConteo[nombreProd] || 0) + cantidad;
        });
      } else if (p.detalles) {
        prodConteo[p.detalles] = (prodConteo[p.detalles] || 0) + 1;
      }

      // Conteo por Zonas de Envío
      const zona = p.zonaEnvio || p.direccion || 'No especificada';
      zonaConteo[zona] = (zonaConteo[zona] || 0) + Number(p.total || 0);
    });

    setVentasTotales(tTotal);
    setVentasDiarias(tDiario);
    setVentasSemanales(tSemanal);
    setVentasMensuales(tMensual);

    // Ordenar productos más vendidos (Top 5)
    const productosOrdenados = Object.keys(prodConteo)
      .map((nombre) => ({ nombre, cantidad: prodConteo[nombre] }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
    setProductosMasVendidos(productosOrdenados);

    setIngresosPorZona(zonaConteo);

    // PROCESAR TOP 5 CLIENTES FRECUENTES
    const topClientesOrdenados = Object.values(clientesMap)
      .filter((c) => c.totalGastado > 0)
      .sort((a, b) => b.totalGastado - a.totalGastado)
      .slice(0, 5);
    setTopClientes(topClientesOrdenados);

    // PROCESAR INVENTARIO CRÍTICO (Poco o Sin Stock <= 5 unidades)
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
          <p style={{ fontSize: '12px', color: '#888', margin: '4px 0 0 0' }}>Métricas en tiempo real del negocio e inventario</p>
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
                  <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Ventas Históricas Acumuladas</span>
                  <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#E50914', margin: '8px 0 0 0' }}>
                    RD$ {ventasTotales.toLocaleString()}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#666' }}>Total de órdenes: {totalPedidosCount}</span>
                </div>

              </div>
            </div>

            {/* SECCIÓN 2: PRODUCTOS MÁS VENDIDOS Y ZONAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              
              {/* PRODUCTOS MÁS VENDIDOS */}
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
                  <p style={{ color: '#666', fontSize: '13px' }}>No hay registros de zonas de envío.</p>
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
              
              {/* TOP 5 CLIENTES FRECUENTES */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '15px' }}>👥 Top 5 Clientes Frecuentes (VIP)</h2>
                {topClientes.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>Aún no hay compras registradas de clientes.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {topClientes.map((cliente, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1A1A', padding: '10px 12px', borderRadius: '6px', border: '1px solid #252525' }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 'bold', margin: 0 }}>{index + 1}. {cliente.nombre}</p>
                          <span style={{ fontSize: '11px', color: '#888' }}>{cliente.pedidosCount} orden(es) realizada(s)</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#25D366' }}>
                          RD$ {cliente.totalGastado.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ALERTA DE STOCK CRÍTICO */}
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
