// pages/admin/metricas.js
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function MetricasAdmin() {
  const [mes, setMes] = useState('2026-09');
  const [loading, setLoading] = useState(true);
  
  // Estados de cálculo
  const [ventasBrutas, setVentasBrutas] = useState(0);
  const [pedidosDesglose, setPedidosDesglose] = useState([]);
  const [mostrarDesgloseVentas, setMostrarDesgloseVentas] = useState(false);

  const [totalCostosProductos, setTotalCostosProductos] = useState(0);
  const [totalGastosOperativos, setTotalGastosOperativos] = useState(0);
  const [totalTecnico, setTotalTecnico] = useState(0);
  const [totalTransportista, setTotalTransportista] = useState(0);
  const [gananciaNeta, setGananciaNeta] = useState(0);

  const cargarMetricas = useCallback(async () => {
    setLoading(true);
    try {
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      let sumaVentas = 0;
      let listaPedidosMes = [];

      snapPedidos.forEach((doc) => {
        const p = doc.data();
        let fechaPedido = p.fecha ? (p.fecha.toDate ? p.fecha.toDate() : new Date(p.fecha)) : new Date();
        const mesPedido = `${fechaPedido.getFullYear()}-${String(fechaPedido.getMonth() + 1).padStart(2, '0')}`;

        if (mesPedido === mes) {
          const montoTotalPedido = Number(p.total ?? p.monto ?? p.precioTotal ?? 0);
          
          if (montoTotalPedido > 0) {
            sumaVentas += montoTotalPedido;
            listaPedidosMes.push({
              id: doc.id.substring(0, 8),
              cliente: p.cliente || p.nombre || 'Cliente General',
              fecha: fechaPedido.toLocaleDateString('es-DO'),
              metodoPago: p.metodoPago || p.pago || 'Efectivo / Transferencia',
              monto: montoTotalPedido
            });
          }
        }
      });

      setVentasBrutas(sumaVentas);
      setPedidosDesglose(listaPedidosMes);

      // Simulación o carga de otros rubros (Tecnico, Transportista, Gastos)
      // Ajustar según la lógica existente en tu base de datos
      const totalTec = listaPedidosMes.length > 0 ? 2800 : 0;
      const totalTrans = listaPedidosMes.length > 0 ? 200 : 0;
      const costosProds = sumaVentas * 0.4; // Ejemplo o cálculo de costo de inventario
      const gastosOp = 0;

      setTotalTecnico(totalTec);
      setTotalTransportista(totalTrans);
      setTotalCostosProductos(costosProds);
      setTotalGastosOperativos(gastosOp);

      const neta = sumaVentas - (costosProds + gastosOp + totalTec + totalTrans);
      setGananciaNeta(neta);

    } catch (e) {
      console.error("Error cargando métricas:", e);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    cargarMetricas();
  }, [mes, cargarMetricas]);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif', padding: '30px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Encabezado y Selector de Mes */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#FFB800' }}>Panel de Métricas Financieras</h1>
          <div>
            <label style={{ marginRight: '10px', fontSize: '14px', color: '#AAA' }}>Período:</label>
            <input 
              type="month" 
              value={mes} 
              onChange={(e) => setMes(e.target.value)}
              style={{ background: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 12px', borderRadius: '5px' }}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#888' }}>Calculando métricas del período...</p>
        ) : (
          <>
            {/* Tarjetas de Resumen */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              
              {/* Tarjeta Ventas Brutas con Desglose */}
              <div style={{ background: '#141414', border: '1px solid #333', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#AAA', fontSize: '14px' }}>Ventas Totales Brutas</span>
                  <button 
                    onClick={() => setMostrarDesgloseVentas(!mostrarDesgloseVentas)}
                    style={{ background: '#222', color: '#FFB800', border: '1px solid #FFB800', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    {mostrarDesgloseVentas ? 'Ocultar Desglose' : '🔍 Ver Desglose'}
                  </button>
                </div>
                <h2 style={{ fontSize: '28px', color: '#FFF', margin: '10px 0 0 0' }}>
                  RD$ {ventasBrutas.toLocaleString()}
                </h2>
                <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 0 0' }}>
                  Total acumulado de órdenes en el mes ({pedidosDesglose.length} pedidos)
                </p>
              </div>

              {/* Tarjeta Técnico */}
              <div style={{ background: '#141414', border: '1px solid #333', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#AAA', fontSize: '14px' }}>Pago Técnico Instalador</span>
                  <Link href={`/admin/desglose-tecnico?mes=${mes}`} style={{ color: '#FFB800', fontSize: '12px', textDecoration: 'underline' }}>
                    Ver Detalle
                  </Link>
                </div>
                <h2 style={{ fontSize: '28px', color: '#FFB800', margin: '10px 0 0 0' }}>
                  RD$ {totalTecnico.toLocaleString()}
                </h2>
              </div>

              {/* Tarjeta Transportista */}
              <div style={{ background: '#141414', border: '1px solid #333', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#AAA', fontSize: '14px' }}>Pago Envíos / Mensajería</span>
                  <Link href={`/admin/desglose-transportista?mes=${mes}`} style={{ color: '#3182CE', fontSize: '12px', textDecoration: 'underline' }}>
                    Ver Detalle
                  </Link>
                </div>
                <h2 style={{ fontSize: '28px', color: '#3182CE', margin: '10px 0 0 0' }}>
                  RD$ {totalTransportista.toLocaleString()}
                </h2>
              </div>

            </div>

            {/* TABLA DE DESGLOSE DE VENTAS BRUTAS (Desplegable) */}
            {mostrarDesgloseVentas && (
              <div style={{ background: '#141414', border: '1px solid #FFB800', borderRadius: '10px', padding: '20px', marginBottom: '30px' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#FFB800' }}>
                  📋 Desglose de Ventas Brutas ({mes})
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333', textAlign: 'left', color: '#AAA' }}>
                      <th style={{ padding: '8px' }}>Fecha</th>
                      <th style={{ padding: '8px' }}>Orden / ID</th>
                      <th style={{ padding: '8px' }}>Cliente</th>
                      <th style={{ padding: '8px' }}>Método de Pago</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Monto Bruto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosDesglose.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '15px', textAlign: 'center', color: '#888' }}>No hay ventas registradas en este período.</td>
                      </tr>
                    ) : (
                      pedidosDesglose.map((pedido, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '8px' }}>{pedido.fecha}</td>
                          <td style={{ padding: '8px', color: '#FFB800' }}>#{pedido.id}</td>
                          <td style={{ padding: '8px' }}>{pedido.cliente}</td>
                          <td style={{ padding: '8px', color: '#AAA' }}>{pedido.metodoPago}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>RD$ {pedido.monto.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #FFB800', fontWeight: 'bold' }}>
                      <td colSpan="4" style={{ padding: '10px 8px', textAlign: 'right' }}>TOTAL BRUTO SUMADO:</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#FFB800', fontSize: '15px' }}>RD$ {ventasBrutas.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Resumen Final / Ganancia Neta */}
            <div style={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>Ganancia Neta Estimada</h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#888' }}>Ventas Brutas menos costos de productos, pagos de instalador y transporte</p>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 'bold', color: gananciaNeta >= 0 ? '#48BB78' : '#F56565' }}>
                RD$ {gananciaNeta.toLocaleString()}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
