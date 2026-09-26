// pages/admin/analiticas.js
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AnaliticasDashboard() {
  const [loading, setLoading] = useState(true);
  const [pedidosOriginales, setPedidosOriginales] = useState([]);
  
  // Estado del Filtro seleccionado ('todos', 'hoy', 'semana', 'mes', 'mes_pasado')
  const [filtroTiempo, setFiltroTiempo] = useState('todos');

  // Métricas calculadas dinámicamente
  const [ventasFiltradasTotal, setVentasFiltradasTotal] = useState(0);
  const [totalPedidosFiltrados, setTotalPedidosFiltrados] = useState(0);
  const [productosMasVendidos, setProductosMasVendidos] = useState([]);
  const [ingresosPorZona, setIngresosPorZona] = useState({});

  useEffect(() => {
    cargarDatosAnalitica();
  }, []);

  // Cada vez que cambie el filtro, recalculamos las métricas con los datos ya descargados
  useEffect(() => {
    if (pedidosOriginales.length > 0) {
      procesarMetricasConFiltro(pedidosOriginales, filtroTiempo);
    }
  }, [filtroTiempo, pedidosOriginales]);

  const cargarDatosAnalitica = async () => {
    try {
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      const listaPedidos = [];
      snapPedidos.forEach((doc) => {
        listaPedidos.push({ id: doc.id, ...doc.data() });
      });
      setPedidosOriginales(listaPedidos);
      procesarMetricasConFiltro(listaPedidos, 'todos');
    } catch (error) {
      console.error("Error al cargar datos para analíticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const procesarMetricasConFiltro = (listaPedidos, filtro) => {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    
    const hace7Dias = new Date();
    hace7Dias.setDate(ahora.getDate() - 7);

    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    const mesPasadoIndex = mesActual === 0 ? 11 : mesActual - 1;
    const anioMesPasado = mesActual === 0 ? anioActual - 1 : anioActual;

    let tTotal = 0;
    let contadorPedidos = 0;
    const prodConteo = {};
    const zonaConteo = {};

    listaPedidos.forEach((p) => {
      // Ignorar pedidos cancelados para las finanzas
      if (p.estado === 'Cancelado') return;

      // Obtener fecha real del pedido
      let fechaPedido = ahora;
      if (p.fecha?.toDate) {
        fechaPedido = p.fecha.toDate();
      } else if (p.fecha) {
        fechaPedido = new Date(p.fecha);
      }
      const tiempoPedido = fechaPedido.getTime();

      // Aplicar lógica de filtrado por tiempo
      let cumpleFiltro = true;
      if (filtro === 'hoy') {
        cumpleFiltro = tiempoPedido >= inicioHoy;
      } else if (filtro === 'semana') {
        cumpleFiltro = fechaPedido >= hace7Dias;
      } else if (filtro === 'mes') {
        cumpleFiltro = fechaPedido.getMonth() === mesActual && fechaPedido.getFullYear() === anioActual;
      } else if (filtro === 'mes_pasado') {
        cumpleFiltro = fechaPedido.getMonth() === mesPasadoIndex && fechaPedido.getFullYear() === anioMesPasado;
      }

      if (cumpleFiltro) {
        const monto = Number(p.total || 0);
        tTotal += monto;
        contadorPedidos += 1;

        // Conteo de Productos más vendidos
        if (p.productosDetalle && Array.isArray(p.productosDetalle)) {
          p.productosDetalle.forEach((item) => {
            const nombreProd = item.nombre || item.titulo || 'Producto sin nombre';
            const cantidad = Number(item.cantidad || 1);
            prodConteo[nombreProd] = (prodConteo[nombreProd] || 0) + cantidad;
          });
        } else if (p.detalles) {
          prodConteo[p.detalles] = (prodConteo[p.detalles] || 0) + 1;
        }

        // Conteo por Zonas de Envío
        const zona = p.zonaEnvio || p.direccion || 'No especificada';
        zonaConteo[zona] = (zonaConteo[zona] || 0) + monto;
      }
    });

    setVentasFiltradasTotal(tTotal);
    setTotalPedidosFiltrados(contadorPedidos);

    // Ordenar productos más vendidos (Top 5)
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
          <p style={{ fontSize: '12px', color: '#888', margin: '4px 0 0 0' }}>Métricas de rendimiento e inventario con filtros de fecha</p>
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
        
        {/* BARRA DE FILTROS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141414', border: '1px solid #222', padding: '15px 20px', borderRadius: '10px', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#FFB800' }}>
            🔎 Filtrar Analíticas por Período:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'todos', label: 'Todo el Tiempo' },
              { id: 'hoy', label: 'Hoy' },
              { id: 'semana', label: 'Últimos 7 Días' },
              { id: 'mes', label: 'Mes Actual' },
              { id: 'mes_pasado', label: 'Mes Pasado' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltroTiempo(f.id)}
                style={{
                  backgroundColor: filtroTiempo === f.id ? '#E50914' : '#1A1A1A',
                  color: filtroTiempo === f.id ? '#FFF' : '#AAA',
                  border: filtroTiempo === f.id ? '1px solid #E50914' : '1px solid #333',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '50px 0' }}>Cargando analíticas...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* TARJETAS DE RESULTADOS SEGÚN FILTRO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '25px' }}>
                <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Ventas Totales en el Período</span>
                <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#25D366', margin: '10px 0 0 0' }}>
                  RD$ {ventasFiltradasTotal.toLocaleString()}
                </h3>
              </div>

              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '25px' }}>
                <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Órdenes Registradas en el Período</span>
                <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#FFB800', margin: '10px 0 0 0' }}>
                  {totalPedidosFiltrados} pedidos
                </h3>
              </div>

            </div>

            {/* PRODUCTOS MÁS VENDIDOS Y ZONAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              
              {/* Productos más vendidos */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '15px' }}>🔥 Top Productos Vendidos (En este período)</h2>
                {productosMasVendidos.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>No hay ventas registradas en este período.</p>
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

              {/* Ingresos por Zona */}
              <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFB800', marginBottom: '15px' }}>📍 Ingresos por Zonas (En este período)</h2>
                {Object.keys(ingresosPorZona).length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>No hay registros de zonas en este período.</p>
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
