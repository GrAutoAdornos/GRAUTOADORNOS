import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

// Configuración de tarifas fijas por zona (puedes ajustar los montos aquí)
const PRECIOS_ZONA = {
  'DISTRITO NACIONAL': 250,
  'SANTO DOMINGO ESTE': 350,
  'SANTO DOMINGO NORTE': 400,
  'SANTO DOMINGO OESTE': 300,
  'ZONA HERRERA': 200,
  'ENVÍOS / PROVINCIA': 500,
};

export default function DesgloseTransportista() {
  const router = useRouter();
  const { mes } = router.query;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [totalPagar, setTotalPagar] = useState(0);

  // Obtener nombre de cliente buscando en múltiples propiedades posibles
  const obtenerNombreCliente = (p) => {
    return p.cliente || p.nombre || p.nombreCliente || p.comprador || p.usuario || 'Cliente General';
  };

  // Determinar la zona, dirección y la tarifa asignada
  const obtenerZonaYDireccion = (p, detalles) => {
    let zonaDetectada = p.zona || p.sector || p.provincia || p.tipoEnvio || '';
    let direccionRaw = p.direccion || p.direccionEnvio || p.destino || detalles || '';
    const textoCompleto = `${zonaDetectada} ${direccionRaw} ${detalles}`.toLowerCase();

    // Detección automática si el campo zona no viene configurado explícitamente
    if (!zonaDetectada) {
      if (textoCompleto.includes('herrera')) zonaDetectada = 'ZONA HERRERA';
      else if (textoCompleto.includes('este') || textoCompleto.includes('sde')) zonaDetectada = 'SANTO DOMINGO ESTE';
      else if (textoCompleto.includes('norte') || textoCompleto.includes('sdn')) zonaDetectada = 'SANTO DOMINGO NORTE';
      else if (textoCompleto.includes('oeste') || textoCompleto.includes('sdo')) zonaDetectada = 'SANTO DOMINGO OESTE';
      else if (textoCompleto.includes('distrito nacional') || textoCompleto.includes('dn')) zonaDetectada = 'DISTRITO NACIONAL';
      else if (textoCompleto.includes('interior') || textoCompleto.includes('envio') || textoCompleto.includes('envío') || textoCompleto.includes('provincia')) zonaDetectada = 'ENVÍOS / PROVINCIA';
      else zonaDetectada = 'ZONA ESTÁNDAR';
    } else {
      zonaDetectada = zonaDetectada.toUpperCase();
    }

    const direccionLimpia = p.direccion || p.direccionEnvio || 'Dirección Registrada en Orden';
    
    // Obtener la tarifa establecida para esa zona
    const tarifaZona = PRECIOS_ZONA[zonaDetectada] || PRECIOS_ZONA['ZONA ESTÁNDAR'];

    return {
      zona: zonaDetectada,
      direccion: direccionLimpia,
      tarifaZona
    };
  };

  const cargarDesglose = useCallback(async () => {
    setLoading(true);
    try {
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      const listaEnvios = [];
      let suma = 0;

      snapPedidos.forEach((doc) => {
        const p = doc.data();
        let fechaPedido = p.fecha ? (p.fecha.toDate ? p.fecha.toDate() : new Date(p.fecha)) : new Date();
        const mesPedido = `${fechaPedido.getFullYear()}-${String(fechaPedido.getMonth() + 1).padStart(2, '0')}`;

        const estadoOrden = String(p.estado || p.status || '').toLowerCase().trim();
        const esCompletado = estadoOrden === 'completado' || estadoOrden === 'entregado' || estadoOrden === 'finalizado';

        if (mesPedido === mes && esCompletado) {
          const detalles = String(p.detalles || p.productos || '');
          const infoZona = obtenerZonaYDireccion(p, detalles);

          // Si el objeto p ya trae costoEnvio, se usa; si no, se aplica la tarifa establecida por zona
          let costoEnvioOrden = Number(p.costoEnvio ?? p.envio ?? p.flete ?? infoZona.tarifaZona);

          if (costoEnvioOrden > 0) {
            listaEnvios.push({
              idOrden: doc.id.substring(0, 8),
              cliente: obtenerNombreCliente(p),
              fecha: fechaPedido.toLocaleDateString('es-DO'),
              direccion: infoZona.direccion,
              zona: infoZona.zona,
              tarifaZona: infoZona.tarifaZona,
              monto: costoEnvioOrden
            });
            suma += costoEnvioOrden;
          }
        }
      });

      setItems(listaEnvios);
      setTotalPagar(suma);
    } catch (e) {
      console.error("Error al cargar desglose del transportista:", e);
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
          .badge-zona { border: 1px solid #000 !important; color: #000 !important; background: transparent !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '850px', margin: '0 auto 20px auto' }}>
        <Link href="/admin/metricas" style={{ color: '#FFF', textDecoration: 'none', background: '#222', padding: '8px 15px', borderRadius: '5px', fontSize: '13px' }}>
          ← Volver a Métricas
        </Link>
        <button onClick={imprimirPDF} style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          📄 Descargar Recibo PDF / Imprimir
        </button>
      </div>

      <div className="recibo-container" style={{ maxWidth: '850px', margin: '0 auto', background: '#141414', padding: '30px', borderRadius: '10px', border: '1px solid #333' }}>
        <div style={{ borderBottom: '2px solid #3182CE', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px' }}>GR AUTOADORNOS</h2>
            <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '13px' }}>COMPROBANTE DE PAGO - SERVICIO DE MENSAJERÍA / ENVÍOS</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>Período: {mes}</p>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#888' }}>Emisión: {new Date().toLocaleDateString('es-DO')}</p>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#888' }}>Cargando envíos del mes...</p>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Fecha</th>
                  <th style={{ padding: '10px' }}>Cliente / Orden</th>
                  <th style={{ padding: '10px' }}>Zona Asignada</th>
                  <th style={{ padding: '10px' }}>Dirección</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Tarifa Flete</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No hay datos de envíos registrados en este mes.</td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: '10px' }}>{item.fecha}</td>
                      <td style={{ padding: '10px' }}>
                        <strong style={{ display: 'block' }}>{item.cliente}</strong>
                        <span style={{ fontSize: '11px', color: '#888' }}>Orden #{item.idOrden}</span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span className="badge-zona" style={{ backgroundColor: '#1A202C', color: '#3182CE', border: '1px solid #3182CE', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                          {item.zona}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: '#CCC' }}>{item.direccion}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>RD$ {item.monto.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #3182CE', paddingTop: '15px' }}>
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>TOTAL A PAGAR:</span>
              <span className="texto-resaltado" style={{ fontSize: '20px', fontWeight: 'bold', color: '#3182CE' }}>RD$ {totalPagar.toLocaleString()}</span>
            </div>

            <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
              <div style={{ width: '200px', borderTop: '1px solid #666', paddingTop: '5px', fontSize: '12px' }}>Firma Administrador</div>
              <div style={{ width: '200px', borderTop: '1px solid #666', paddingTop: '5px', fontSize: '12px' }}>Firma Mensajero Conforme</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
