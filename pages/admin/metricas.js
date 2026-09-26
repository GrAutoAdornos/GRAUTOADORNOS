// pages/admin/metricas.js
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function MetricasAdmin() {
  const [mes, setMes] = useState('2026-09');
  const [loading, setLoading] = useState(true);

  // Estados de Métricas
  const [ventasBrutas, setVentasBrutas] = useState(0);
  const [pedidosDesglose, setPedidosDesglose] = useState([]);
  const [mostrarDesgloseVentas, setMostrarDesgloseVentas] = useState(false);

  const [costoProductos, setCostoProductos] = useState(0);
  const [gastosOperativos, setGastosOperativos] = useState(0);
  const [totalTecnico, setTotalTecnico] = useState(0);
  const [totalTransportista, setTotalTransportista] = useState(0);
  const [gananciaNeta, setGananciaNeta] = useState(0);
  const [margenGanancia, setMargenGanancia] = useState(0);

  // Métricas adicionales del sistema
  const [totalOrdenes, setTotalOrdenes] = useState(0);
  const [ticketPromedio, setTicketPromedio] = useState(0);

  const cargarMetricas = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Cargar Pedidos del Mes
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      let sumaVentas = 0;
      let contadorOrdenes = 0;
      let listaPedidosMes = [];
      let sumaTecnico = 0;
      let sumaTransportista = 0;
      let sumaCostoProd = 0;

      snapPedidos.forEach((doc) => {
        const p = doc.data();
        let fechaPedido = p.fecha ? (p.fecha.toDate ? p.fecha.toDate() : new Date(p.fecha)) : new Date();
        const mesPedido = `${fechaPedido.getFullYear()}-${String(fechaPedido.getMonth() + 1).padStart(2, '0')}`;

        if (mesPedido === mes) {
          const montoTotal = Number(p.total ?? p.monto ?? p.precioTotal ?? 0);
          
          if (montoTotal > 0) {
            sumaVentas += montoTotal;
            contadorOrdenes += 1;

            listaPedidosMes.push({
              id: doc.id.substring(0, 8),
              cliente: p.cliente || p.nombre || 'Cliente General',
              fecha: fechaPedido.toLocaleDateString('es-DO'),
              metodoPago: p.metodoPago || p.pago || 'Efectivo / Transferencia',
              monto: montoTotal
            });

            // Suma de instalador / mensajería si está asignado en la orden
            if (p.instalacion) sumaTecnico += Number(p.instalacion);
            if (p.envio) sumaTransportista += Number(p.envio);
            if (p.costoBase) sumaCostoProd += Number(p.costoBase);
          }
        }
      });

      // 2. Cargar Gastos Operativos del Mes (si existe la colección)
      let sumaGastos = 0;
      try {
        const snapGastos = await getDocs(collection(db, 'gastos'));
        snapGastos.forEach((doc) => {
          const g = doc.data();
          let fechaGasto = g.fecha ? (g.fecha.toDate ? g.fecha.toDate() : new Date(g.fecha)) : new Date();
          const mesGasto = `${fechaGasto.getFullYear()}-${String(fechaGasto.getMonth() + 1).padStart(2, '0')}`;
          if (mesGasto === mes) {
            sumaGastos += Number(g.monto || 0);
          }
        });
      } catch (err) {
        console.log("No se encontró colección de gastos directos.");
      }

      // Si las sumas automáticas vinieron en 0, mantener cálculo referencial previa de su plataforma
      const tecFinal = sumaTecnico > 0 ? sumaTecnico : (contadorOrdenes > 0 ? 2800 : 0);
      const transFinal = sumaTransportista > 0 ? sumaTransportista : (contadorOrdenes > 0 ? 200 : 0);
      const costoProdFinal = sumaCostoProd > 0 ? sumaCostoProd : (sumaVentas * 0.40);

      // Asignación de valores a estados
      setVentasBrutas(sumaVentas);
      setPedidosDesglose(listaPedidosMes);
      setTotalOrdenes(contadorOrdenes);
      setTicketPromedio(contadorOrdenes > 0 ? sumaVentas / contadorOrdenes : 0);

      setTotalTecnico(tecFinal);
      setTotalTransportista(transFinal);
      setCostoProductos(costoProdFinal);
      setGastosOperativos(sumaGastos);

      const totalDeducciones = costoProdFinal + sumaGastos + tecFinal + transFinal;
      const neta = sumaVentas - totalDeducciones;
      setGananciaNeta(neta);
      setMargenGanancia(sumaVentas > 0 ? (neta / sumaVentas) * 100 : 0);

    } catch (e) {
      console.error("Error al calcular métricas:", e);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    cargarMetricas();
  }, [mes, cargarMetricas]);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif', padding: '30px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Encabezado y Navegación */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #222', paddingBottom: '15px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#FFB800' }}>Panel de Métricas Financieras</h1>
            <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '13px' }}>Resumen operacional y desglose de ganancias de GR AUTOADORNOS</p>
          </div>
          <div>
            <label style={{ marginRight: '10px', fontSize: '14px', color: '#AAA' }}>Período:</label>
            <input 
              type="month" 
              value={mes} 
              onChange={(e) => setMes(e.target.value)}
              style={{ background: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 12px', borderRadius: '5px', cursor: 'pointer' }}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#888', padding: '50px 0' }}>Cargando métricas y consolidando datos...</p>
        ) : (
          <>
            {/* GRID DE TARJETAS PRINCIPALES */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              
              {/* Ventas Totales Brutas */}
              <div style={{ background: '#141414', border: '1px solid #333', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#AAA', fontSize: '13px', fontWeight: 'bold' }}>Ventas Totales Brutas</span>
                  <button 
                    onClick={() => setMostrarDesgloseVentas(!mostrarDesgloseVentas)}
                    style={{ background: '#222', color: '#FFB800', border: '1px solid #FFB800', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    {mostrarDesgloseVentas ? 'Ocultar' : '🔍 Ver Desglose'}
                  </button>
                </div>
                <h2 style={{ fontSize: '26px', color: '#FFF', margin: '10px 0 0 0' }}>
                  RD$ {ventasBrutas.toLocaleString()}
                </h2>
                <p style={{ fontSize: '12px', color: '#888', margin: '5px 0 0 0' }}>
                  {totalOrdenes} órdenes completadas
                </p>
              </div>

              {/* Pago Técnico Instalador */}
              <div style={{ background: '#141414', border: '1px solid #333', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#AAA', fontSize: '13px', fontWeight: 'bold' }}>Técnico Instalador</span>
                  <Link href={`/admin/desglose-tecnico?mes=${mes}`} style={{ color: '#FFB800', fontSize: '12px', textDecoration: 'underline' }}>
                    Ver Recibo
                  </Link>
                </div>
                <h2 style={{ fontSize: '26px', color: '#FFB800', margin: '10px 0 0 0' }}>
                  RD$ {totalTecnico.toLocaleString()}
                </h2>
                <p style={{ fontSize: '12px', color: '#888', margin: '5px 0 0 0' }}>
                  Pago por mano de obra
                </p>
              </div>

              {/* Pago Envíos / Transportista */}
              <div style={{ background: '#141414', border: '1px solid #333', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#AAA', fontSize: '13px', fontWeight: 'bold' }}>Servicio Envíos</span>
                  <Link href={`/admin/desglose-transportista?mes=${mes}`} style={{ color: '#3182CE', fontSize: '12px', textDecoration: 'underline' }}>
                    Ver Recibo
                  </Link>
                </div>
                <h2 style={{ fontSize: '26px', color: '#3182CE', margin: '10px 0 0 0' }}>
                  RD$ {totalTransportista.toLocaleString()}
                </h2>
                <p style={{ fontSize: '12px', color: '#888', margin: '5px 0 0 0' }}>
                  Pago a mensajería
                </p>
              </div>

              {/* Costo Estimado de Inventario / Productos */}
              <div style={{ background: '#141414', border: '1px solid #333', borderRadius: '10px', padding: '20px' }}>
                <span style={{ color: '#AAA', fontSize: '13px', fontWeight: 'bold' }}>Costo de Productos</span>
                <h2 style={{ fontSize: '26px', color: '#E53E3E', margin: '10px 0 0 0' }}>
                  RD$ {costoProductos.toLocaleString()}
                </h2>
                <p style={{ fontSize: '12px', color: '#888', margin: '5px 0 0 0' }}>
                  Inversión en mercancía
                </p>
              </div>

            </div>

            {/* TABLA DE DESGLOSE DE VENTAS BRUTAS (Aparece al hacer clic en "Ver Desglose") */}
            {mostrarDesgloseVentas && (
              <div style={{ background: '#141414', border: '1px solid #FFB800', borderRadius: '10px', padding: '20px', marginBottom: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#FFB800' }}>
                    📋 Desglose Individual de Ventas Brutas ({mes})
                  </h3>
                  <span style={{ fontSize: '12px', color: '#888' }}>Total {pedidosDesglose.length} registros</span>
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333', textAlign: 'left', color: '#AAA' }}>
                      <th style={{ padding: '8px' }}>Fecha</th>
                      <th style={{ padding: '8px' }}>Código Orden</th>
                      <th style={{ padding: '8px' }}>Cliente</th>
                      <th style={{ padding: '8px' }}>Método de Pago</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Monto Bruto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosDesglose.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '15px', textAlign: 'center', color: '#888' }}>No hay ventas registradas en este mes.</td>
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
                      <td colSpan="4" style={{ padding: '12px 8px', textAlign: 'right' }}>SUMA TOTAL VENTAS BRUTAS:</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#FFB800', fontSize: '16px' }}>RD$ {ventasBrutas.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* SECCIÓN SECUNDARIA DE MÉTRICAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
              <div style={{ background: '#141414', border: '1px solid #222', borderRadius: '8px', padding: '15px' }}>
                <span style={{ color: '#888', fontSize: '12px' }}>Ticket Promedio</span>
                <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '5px 0 0 0', color: '#FFF' }}>
                  RD$ {ticketPromedio.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div style={{ background: '#141414', border: '1px solid #222', borderRadius: '8px', padding: '15px' }}>
                <span style={{ color: '#888', fontSize: '12px' }}>Gastos Operativos</span>
                <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '5px 0 0 0', color: '#FFF' }}>
                  RD$ {gastosOperativos.toLocaleString()}
                </p>
              </div>
              <div style={{ background: '#141414', border: '1px solid #222', borderRadius: '8px', padding: '15px' }}>
                <span style={{ color: '#888', fontSize: '12px' }}>Margen Estimado %</span>
                <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '5px 0 0 0', color: '#48BB78' }}>
                  {margenGanancia.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* RESUMEN FINAL - GANANCIA NETA */}
            <div style={{ background: '#141414', border: '1px solid #FFB800', borderRadius: '10px', padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#FFF' }}>Ganancia Neta Limpia</h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#888' }}>
                  Ventas Brutas minus (Costos de productos + Técnico + Envíos + Gastos)
                </p>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: gananciaNeta >= 0 ? '#FFB800' : '#E53E3E' }}>
                RD$ {gananciaNeta.toLocaleString()}
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}
