// pages/admin/clientes.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function ClientesAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('TODOS'); // 'TODOS', 'PENDIENTES', 'CONTACTADOS'
  const [busqueda, setBusqueda] = useState(''); // <-- NUEVO ESTADO PARA BÚSQUEDA RÁPIDA
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) {
      router.push('/admin/login');
      return;
    }
    cargarClientesYHistorial();
  }, [router]);

  const cargarClientesYHistorial = async () => {
    setLoading(true);
    try {
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      const mapaClientes = {};

      snapPedidos.forEach((documento) => {
        const data = documento.data();
        const idPedido = documento.id;
        const nombreCliente = data.cliente || data.nombre || 'Cliente Sin Nombre';
        const telefono = data.telefono || data.phone || 'Sin Teléfono';
        const direccion = data.direccion || data.sector || 'Dirección no registrada';
        const fechaPedido = data.fecha ? (data.fecha.toDate ? data.fecha.toDate() : new Date(data.fecha)) : new Date();
        const totalPedido = Number(data.total ?? data.monto ?? 0);
        const detalles = String(data.detalles || data.productos || 'Sin detalle de productos');
        const contactado = Boolean(data.fidelizacionContactado ?? false);

        const claveUnica = telefono !== 'Sin Teléfono' ? telefono : nombreCliente;

        if (!mapaClientes[claveUnica]) {
          mapaClientes[claveUnica] = {
            idDocUltimoPedido: idPedido,
            nombre: nombreCliente,
            telefono: telefono,
            direccion: direccion,
            totalInvertido: 0,
            contactado: contactado,
            historialCompras: []
          };
        }

        mapaClientes[claveUnica].totalInvertido += totalPedido;

        if (contactado) mapaClientes[claveUnica].contactado = true;

        mapaClientes[claveUnica].historialCompras.push({
          idOrden: idPedido.substring(0, 8),
          fecha: fechaPedido.toLocaleDateString('es-DO'),
          productos: detalles,
          monto: totalPedido
        });
      });

      const listaFinal = Object.values(mapaClientes);
      setClientes(listaFinal);
    } catch (error) {
      console.error("Error al cargar clientes:", error);
    } finally {
      setLoading(false);
    }
  };

  // Marcar como contactado en Firebase y abrir WhatsApp
  const marcarYEnviarWhatsapp = async (cliente) => {
    try {
      if (cliente.idDocUltimoPedido) {
        const refPedido = doc(db, 'pedidos', cliente.idDocUltimoPedido);
        await updateDoc(refPedido, { fidelizacionContactado: true });
      }

      setClientes((prev) =>
        prev.map((c) =>
          c.telefono === cliente.telefono ? { ...c, contactado: true } : c
        )
      );

      const telLimpio = String(cliente.telefono).replace(/\D/g, '');
      const mensaje = `Hola ${cliente.nombre}, ¡saludos de GR Auto Adornos! 🚗✨ Queríamos saber cómo te va con tus productos y si necesitas algún accesorio o servicio adicional. ¡Estamos a tu orden!`;
      const urlWhatsapp = `https://wa.me/1${telLimpio}?text=${encodeURIComponent(mensaje)}`;

      window.open(urlWhatsapp, '_blank');
    } catch (error) {
      console.error("Error al marcar cliente como contactado:", error);
    }
  };

  // FILTRADO INTELIGENTE (Por Estado + Búsqueda por Nombre o Teléfono)
  const clientesFiltrados = clientes.filter((c) => {
    // 1. Filtro por estado
    let cumpleEstado = true;
    if (filtroEstado === 'PENDIENTES') cumpleEstado = !c.contactado;
    if (filtroEstado === 'CONTACTADOS') cumpleEstado = c.contactado;

    // 2. Filtro por barra de búsqueda (Nombre o Teléfono)
    const textoBusqueda = busqueda.toLowerCase().trim();
    const cumpleBusqueda =
      !textoBusqueda ||
      c.nombre.toLowerCase().includes(textoBusqueda) ||
      c.telefono.toLowerCase().includes(textoBusqueda);

    return cumpleEstado && cumpleBusqueda;
  });

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>
            GR <span style={{ color: '#E50914' }}>CRM & BÚSQUEDA RÁPIDA</span>
          </span>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>
            Volver al Panel
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '25px 20px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '10px' }}>Base de Clientes & Búsqueda Rápida</h2>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>
          Busca instantáneamente por nombre o número de teléfono, revisa su historial y gestiona el seguimiento.
        </p>

        {/* BARRA DE BÚSQUEDA RÁPIDA GLOBAL */}
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="🔍 Buscar cliente por nombre o teléfono (ej: Juan, 809...)"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#141414',
              color: '#FFF',
              border: '1px solid #333',
              padding: '12px 15px',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        {/* BARRA DE FILTROS DE ESTADO */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFiltroEstado('TODOS')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #333',
              backgroundColor: filtroEstado === 'TODOS' ? '#E50914' : '#141414',
              color: '#FFF',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px'
            }}
          >
            Todos ({clientes.length})
          </button>
          <button
            onClick={() => setFiltroEstado('PENDIENTES')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #FFB800',
              backgroundColor: filtroEstado === 'PENDIENTES' ? '#FFB800' : '#141414',
              color: filtroEstado === 'PENDIENTES' ? '#000' : '#FFB800',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px'
            }}
          >
            ⏳ Pendientes de Mensaje ({clientes.filter((c) => !c.contactado).length})
          </button>
          <button
            onClick={() => setFiltroEstado('CONTACTADOS')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #25D366',
              backgroundColor: filtroEstado === 'CONTACTADOS' ? '#25D366' : '#141414',
              color: filtroEstado === 'CONTACTADOS' ? '#000' : '#25D366',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px'
            }}
          >
            ✅ Ya Contactados ({clientes.filter((c) => c.contactado).length})
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>Cargando clientes y pedidos...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: clienteSeleccionado ? '1.2fr 1fr' : '1fr', gap: '20px' }}>
            
            {/* LISTA DE CLIENTES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {clientesFiltrados.length === 0 ? (
                <p style={{ color: '#888', background: '#141414', padding: '20px', borderRadius: '8px', border: '1px solid #222', textAlign: 'center' }}>
                  No se encontraron clientes con esos criterios de búsqueda.
                </p>
              ) : (
                clientesFiltrados.map((cliente, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: '#141414',
                      border: clienteSeleccionado?.telefono === cliente.telefono ? '1px solid #E50914' : '1px solid #222',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#FFF' }}>{cliente.nombre}</h3>
                        {cliente.contactado ? (
                          <span style={{ backgroundColor: '#1C3829', color: '#25D366', border: '1px solid #25D366', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                            ✅ Contactado
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#382D1C', color: '#FFB800', border: '1px solid #FFB800', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                            ⏳ Pendiente
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '2px 0', fontSize: '12px', color: '#AAA' }}>📞 Teléfono: {cliente.telefono}</p>
                      <p style={{ margin: '2px 0', fontSize: '12px', color: '#AAA' }}>📍 Dirección: {cliente.direccion}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#25D366', fontWeight: 'bold' }}>
                        💰 Total Comprado: RD$ {cliente.totalInvertido.toLocaleString()} ({cliente.historialCompras.length} compras)
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setClienteSeleccionado(cliente)}
                        style={{
                          backgroundColor: '#222',
                          color: '#FFF',
                          border: '1px solid #444',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        🔍 Ver Historial
                      </button>

                      <button
                        onClick={() => marcarYEnviarWhatsapp(cliente)}
                        style={{
                          backgroundColor: cliente.contactado ? '#1E293B' : '#25D366',
                          color: cliente.contactado ? '#94A3B8' : '#000',
                          border: 'none',
                          padding: '8px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        {cliente.contactado ? '📲 Enviar de Nuevo' : '📲 WhatsApp'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* HISTORIAL Y DETALLES DEL CLIENTE SELECCIONADO */}
            {clienteSeleccionado && (
              <div style={{ backgroundColor: '#141414', border: '1px solid #333', borderRadius: '10px', padding: '20px', position: 'sticky', top: '20px', height: 'fit-content' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#FFB800' }}>
                    📦 Historial de {clienteSeleccionado.nombre}
                  </h3>
                  <button
                    onClick={() => setClienteSeleccionado(null)}
                    style={{ background: 'transparent', color: '#888', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ fontSize: '13px', marginBottom: '15px', color: '#CCC' }}>
                  <p style={{ margin: '3px 0' }}><strong>📞 WhatsApp:</strong> {clienteSeleccionado.telefono}</p>
                  <p style={{ margin: '3px 0' }}><strong>📍 Ubicación:</strong> {clienteSeleccionado.direccion}</p>
                  <p style={{ margin: '3px 0', color: '#25D366' }}>
                    <strong>Total acumulado:</strong> RD$ {clienteSeleccionado.totalInvertido.toLocaleString()}
                  </p>
                </div>

                <h4 style={{ fontSize: '13px', color: '#AAA', marginBottom: '10px' }}>Productos Comprados Anteriormente:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                  {clienteSeleccionado.historialCompras.map((compra, i) => (
                    <div key={i} style={{ backgroundColor: '#0D0D0D', padding: '10px', borderRadius: '6px', border: '1px solid #222' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                        <span>Fecha: {compra.fecha}</span>
                        <span style={{ color: '#FFB800' }}>Orden #{compra.idOrden}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: '#FFF' }}>{compra.productos}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#25D366', fontWeight: 'bold', textAlign: 'right' }}>
                        RD$ {compra.monto.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
