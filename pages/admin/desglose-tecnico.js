// pages/admin/desglose-tecnico.js
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function DesgloseTecnico() {
  const router = useRouter();
  const { mes } = router.query;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [totalPagar, setTotalPagar] = useState(0);

  const cargarDesglose = useCallback(async () => {
    setLoading(true);
    try {
      const snapProds = await getDocs(collection(db, 'productos'));
      const mapaProductos = {};
      snapProds.forEach((doc) => {
        const p = doc.data();
        mapaProductos[p.nombre] = Number(p.precioInstalacion ?? p.costoInstalacion ?? p.instalacionPrecio ?? 100);
      });

      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      const listaInstalaciones = [];
      let suma = 0;

      snapPedidos.forEach((doc) => {
        const p = doc.data();
        let fechaPedido = p.fecha ? (p.fecha.toDate ? p.fecha.toDate() : new Date(p.fecha)) : new Date();
        const mesPedido = `${fechaPedido.getFullYear()}-${String(fechaPedido.getMonth() + 1).padStart(2, '0')}`;

        if (mesPedido === mes) {
          const detalles = String(p.detalles || p.productos || '');
          let montoOrden = Number(p.costoInstalacion ?? p.instalacion ?? 0);

          if (montoOrden > 0) {
            listaInstalaciones.push({
              idOrden: doc.id.substring(0, 8),
              cliente: p.cliente || p.nombre || 'Cliente General',
              fecha: fechaPedido.toLocaleDateString('es-DO'),
              detalle: 'Instalación registrada directamente',
              monto: montoOrden
            });
            suma += montoOrden;
          } else if (detalles.toLowerCase().includes('instalación')) {
            Object.keys(mapaProductos).forEach((nombreProd) => {
              if (detalles.includes(nombreProd)) {
                const regex = new RegExp(`${nombreProd.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\(x(\\d+)\\)`, 'i');
                const match = detalles.match(regex);
                const cant = match ? parseInt(match[1], 10) : 1;
                const tarifa = mapaProductos[nombreProd] || 100;
                const subtotal = tarifa * cant;

                listaInstalaciones.push({
                  idOrden: doc.id.substring(0, 8),
                  cliente: p.cliente || p.nombre || 'Cliente General',
                  fecha: fechaPedido.toLocaleDateString('es-DO'),
                  // Muestra la cantidad y la tarifa unitaria en el texto
                  detalle: `Instalación: ${nombreProd} (${cant} x RD$ ${tarifa.toLocaleString()})`,
                  monto: subtotal
                });
                suma += subtotal;
              }
            });
          }
        }
      });

      setItems(listaInstalaciones);
      setTotalPagar(suma);
    } catch (e) {
      console.error("Error al cargar desglose del técnico:", e);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    if (mes) cargarDesglose();
  }, [mes, cargarDesglose]);

  const imprimirPDF = () => {
    window.print();
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif', padding: '20px' }}>
      <style>{`
        @media print {
          body { background-color: #FFF !important; color: #000 !important; }
          .no-print { display: none !important; }
          .recibo-container { border: 1px solid #000 !important; color: #000 !important; background: #FFF !important; width: 100% !important; max-width: 100% !important; box-shadow: none !important; }
          th, td { border-bottom: 1px solid #333 !important; color: #000 !important; }
          .texto-resaltado { color: #000 !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '800px', margin: '0 auto 20px auto' }}>
        <Link href="/admin/metricas" style={{ color: '#FFF', textDecoration: 'none', background: '#222', padding: '8px 15px', borderRadius: '5px', fontSize: '13px' }}>
          ← Volver a Métricas
        </Link>
        <button onClick={imprimirPDF} style={{ background: '#FFB800', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          📄 Descargar Recibo PDF / Imprimir
        </button>
      </div>

      <div className="recibo-container" style={{ maxWidth: '800px', margin: '0 auto', background: '#141414', padding: '30px', borderRadius: '10px', border: '1px solid #333' }}>
        <div style={{ borderBottom: '2px solid #FFB800', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px' }}>GR AUTOADORNOS</h2>
            <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '13px' }}>COMPROBANTE DE PAGO - TÉCNICO INSTALADOR</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>Período: {mes}</p>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#888' }}>Emisión: {new Date().toLocaleDateString('es-DO')}</p>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#888' }}>Cargando trabajos del mes...</p>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Fecha</th>
                  <th style={{ padding: '10px' }}>Cliente / Orden</th>
                  <th style={{ padding: '10px' }}>Detalle Trabajo</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No hay datos de instalaciones asignadas en este mes.</td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: '10px' }}>{item.fecha}</td>
                      <td style={{ padding: '10px' }}>{item.cliente} (#{item.idOrden})</td>
                      <td style={{ padding: '10px' }}>{item.detalle}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>RD$ {item.monto.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #FFB800', paddingTop: '15px' }}>
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>TOTAL A PAGAR:</span>
              <span className="texto-resaltado" style={{ fontSize: '20px', fontWeight: 'bold', color: '#FFB800' }}>RD$ {totalPagar.toLocaleString()}</span>
            </div>

            <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
              <div style={{ width: '200px', borderTop: '1px solid #666', paddingTop: '5px', fontSize: '12px' }}>Firma Administrador</div>
              <div style={{ width: '200px', borderTop: '1px solid #666', paddingTop: '5px', fontSize: '12px' }}>Firma Técnico Conforme</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
