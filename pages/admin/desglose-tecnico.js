// pages/admin/desglose-tecnico.js
import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (mes) cargarDesglose();
  }, [mes]);

  const cargarDesglose = async () => {
    setLoading(true);
    try {
      // 1. Obtener productos para consultar sus tarifas reales
      const snapProds = await getDocs(collection(db, 'productos'));
      const mapaProductos = {};
      snapProds.forEach((doc) => {
        const p = doc.data();
        mapaProductos[p.nombre] = Number(p.precioInstalacion ?? p.costoInstalacion ?? p.instalacionPrecio ?? 100);
      });

      // 2. Obtener pedidos
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
              idOrden: doc.id,
              cliente: p.cliente || p.nombre || 'Cliente General',
              fecha: fechaPedido.toLocaleDateString('es-DO'),
              detalle: 'Instalación manual asignada',
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
                  detalle: `Instalación: ${nombreProd} (x${cant})`,
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
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const imprimirRecibo = () => {
    window.print();
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif', padding: '20px' }}>
      <style>{`
        @media print {
          body { background-color: #FFF !important; color: #000 !important; }
          .no-print { display: none !important; }
          .recibo-container { border: 1px solid #000 !important; color: #000 !important; background: #FFF !important; }
          th, td { border-bottom: 1px solid #000 !important; color: #000 !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <Link href="/admin/metricas" style={{ color: '#FFF', textDecoration: 'none', background: '#222', padding: '8px 15px', borderRadius: '5px' }}>
          ← Volver a Métricas
        </Link>
        <button onClick={imprimirRecibo} style={{ background: '#E50914', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          🖨️ Descargar Recibo PDF / Imprimir
        </button>
      </div>

      <div className="recibo-container" style={{ maxWidth: '800px', margin: '0 auto', background: '#141414', padding: '30px', borderRadius: '10px', border: '1px solid #333' }}>
        <div style={{ borderBottom: '2px solid #FFB800', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0 }}>GR AUTOADORNOS</h2>
            <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '13px' }}>COMPROBANTE DE PAGO - TÉCNICO INSTALADOR</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>Período: {mes}</p>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#888' }}>Fecha de Emisión: {new Date().toLocaleDateString('es-DO')}</p>
          </div>
        </div>

        {loading ? (
          <p>Cargando detalles...</p>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Fecha</th>
                  <th style={{ padding: '10px' }}>Cliente / Orden</th>
                  <th style={{ padding: '10px' }}>Detalle Trabajo</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '10px' }}>{item.fecha}</td>
                    <td style={{ padding: '10px' }}>{item.cliente} (#{item.idOrden})</td>
                    <td style={{ padding: '10px' }}>{item.detalle}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>RD$ {item.monto.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #FFB800', paddingTop: '15px' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>TOTAL A PAGAR:</span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#FFB800' }}>RD$ {totalPagar.toLocaleString()}</span>
            </div>

            <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
              <div style={{ width: '200px', borderTop: '1px solid #666', paddingTop: '5px', fontSize: '12px' }}>Firma Administrador</div>
              <div style={{ width: '200px', borderTop: '1px solid #666', paddingTop: '5px', fontSize: '12px' }}>Firma Técnico Conforme</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
