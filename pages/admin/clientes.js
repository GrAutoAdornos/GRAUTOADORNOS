import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function ClientesAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) {
      router.push('/admin/login');
      return;
    }
    cargarClientesYHistorial();
  }, [router]);

  // 1. Extraer Nombre
  const extraerNombre = (data) => {
    if (!data) return 'Cliente Sin Nombre';
    
    if (data.cliente && typeof data.cliente === 'object') {
      const c = data.cliente;
      if (c.nombre) return c.nombre;
      if (c.name) return c.name;
      if (c.fullName) return c.fullName;
      if (c.nombreCliente) return c.nombreCliente;
    }

    if (typeof data.cliente === 'string' && data.cliente.trim() !== '') {
      return data.cliente;
    }

    if (data.nombreCliente) return data.nombreCliente;
    if (data.clienteNombre) return data.clienteNombre;
    if (data.nombre_cliente) return data.nombre_cliente;
    if (data.nombre) return data.nombre;
    if (data.name) return data.name;
    if (data.fullName) return data.fullName;
    if (data.comprador) return data.comprador;
    if (data.usuario) return data.usuario;
    if (data.displayName) return data.displayName;

    if (data.envio && typeof data.envio === 'object') {
      if (data.envio.nombre) return data.envio.nombre;
      if (data.envio.nombreCliente) return data.envio.nombreCliente;
    }
    if (data.datos && typeof data.datos === 'object') {
      if (data.datos.nombre) return data.datos.nombre;
    }

    return 'Cliente Sin Nombre';
  };

  // 2. Extraer Teléfono (ampliado)
  const extraerTelefono = (data) => {
    if (!data) return 'Sin Teléfono';

    if (data.cliente && typeof data.cliente === 'object') {
      const c = data.cliente;
      if (c.telefono || c.phone || c.celular || c.tel || c.whatsapp) {
        return c.telefono || c.phone || c.celular || c.tel || c.whatsapp;
      }
    }

    if (data.envio && typeof data.envio === 'object') {
      if (data.envio.telefono || data.envio.phone || data.envio.celular) {
        return data.envio.telefono || data.envio.phone || data.envio.celular;
      }
    }

    if (data.datos && typeof data.datos === 'object') {
      if (data.datos.telefono || data.datos.phone || data.datos.celular) {
        return data.datos.telefono || data.datos.phone || data.datos.celular;
      }
    }

    return (
      data.telefono || 
      data.phone || 
      data.celular || 
      data.tel || 
      data.whatsapp || 
      'Sin Teléfono'
    );
  };

  // 3. Extraer Email (nueva función)
  const extraerEmail = (data) => {
    if (!data) return 'Sin Correo';

    if (data.cliente && typeof data.cliente === 'object') {
      const c = data.cliente;
      if (c.email || c.correo || c.mail) {
        return c.email || c.correo || c.mail;
      }
    }

    if (data.envio && typeof data.envio === 'object') {
      if (data.envio.email || data.envio.correo) {
        return data.envio.email || data.envio.correo;
      }
    }

    if (data.datos && typeof data.datos === 'object') {
      if (data.datos.email || data.datos.correo) {
        return data.datos.email || data.datos.correo;
      }
    }

    return (
      data.email || 
      data.correo || 
      data.mail || 
      'Sin Correo'
    );
  };

  // 4. Extraer Dirección
  const extraerDireccion = (data) => {
    if (!data) return 'Dirección no registrada';

    if (data.cliente && typeof data.cliente === 'object') {
      const c = data.cliente;
      if (c.direccion || c.sector || c.address) {
        return c.direccion || c.sector || c.address;
      }
    }

    return (
      data.direccion || 
      data.sector || 
      data.address || 
      data.ubicacion || 
      (data.envio && (data.envio.direccion || data.envio.sector)) ||
      'Dirección no registrada'
    );
  };

  const cargarClientesYHistorial = async () => {
    setLoading(true);
    try {
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      const mapaClientes = {};

      snapPedidos.forEach((documento) => {
        const data = documento.data();
        const idPedido = documento.id;

        const nombreCliente = extraerNombre(data);
        const telefono = extraerTelefono(data);
        const email = extraerEmail(data);
        const direccion = extraerDireccion(data);

        const fechaPedido = data.fecha ? (data.fecha.toDate ? data.fecha.toDate() : new Date(data.fecha)) : new Date();
        const totalPedido = Number(data.total ?? data.monto ?? data.totalPago ?? 0);
        
        // Extracción de Productos
        let detalles = 'Sin detalle de productos';
        if (Array.isArray(data.productos)) {
          detalles = data.productos.map(p => `${p.cantidad || 1}x ${p.titulo || p.nombre || p.title || 'Producto'}`).join(', ');
        } else if (Array.isArray(data.items)) {
          detalles = data.items.map(p => `${p.cantidad || 1}x ${p.titulo || p.nombre || 'Producto'}`).join(', ');
        } else if (data.detalles) {
          detalles = String(data.detalles);
        } else if (typeof data.productos === 'string') {
          detalles = data.productos;
        }

        const contactado = Boolean(data.fidelizacionContactado ?? false);

        // Agrupar por teléfono, email o nombre para no duplicar clientes
        const claveUnica = (telefono !== 'Sin Teléfono') 
          ? telefono 
          : (email !== 'Sin Correo' ? email : (nombreCliente !== 'Cliente Sin Nombre' ? nombreCliente : idPedido));

        if (!mapaClientes[claveUnica]) {
          mapaClientes[claveUnica] = {
            idDocUltimoPedido: idPedido,
            nombre: nombreCliente,
            telefono: telefono,
            email: email,
            direccion: direccion,
            totalInvertido: 0,
            contactado: contactado,
            historialCompras: []
          };
        } else {
          // Completar o actualizar datos si estaban incompletos
          if (mapaClientes[claveUnica].nombre === 'Cliente Sin Nombre' && nombreCliente !== 'Cliente Sin Nombre') {
            mapaClientes[claveUnica].nombre = nombreCliente;
          }
          if (mapaClientes[claveUnica].telefono === 'Sin Teléfono' && telefono !== 'Sin Teléfono') {
            mapaClientes[claveUnica].telefono = telefono;
          }
          if (mapaClientes[claveUnica].email === 'Sin Correo' && email !== 'Sin Correo') {
            mapaClientes[claveUnica].email = email;
          }
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
      const nombreSaludo = cliente.nombre !== 'Cliente Sin Nombre' ? cliente.nombre : 'estimado/a cliente';
      const mensaje = `Hola ${nombreSaludo}, ¡saludos de GR Auto Adornos! 🚗✨ Queríamos saber cómo te va con tus productos y si necesitas algún accesorio o servicio adicional. ¡Estamos a tu orden!`;
      const urlWhatsapp = `https://wa.me/1${telLimpio}?text=${encodeURIComponent(mensaje)}`;

      window.open(urlWhatsapp, '_blank');
    } catch (error) {
      console.error("Error al marcar cliente como contactado:", error);
    }
  };

  const clientesFiltrados = clientes.filter((c) => {
    let cumpleEstado = true;
    if (filtroEstado === 'PENDIENTES') cumpleEstado = !c.contactado;
    if (filtroEstado === 'CONTACTADOS') cumpleEstado = c.contactado;

    const textoBusqueda = busqueda.toLowerCase().trim();
    const cumpleBusqueda =
      !textoBusqueda ||
      c.nombre.toLowerCase().includes(textoBusqueda) ||
      c.telefono.toLowerCase().includes(textoBusqueda) ||
      c.email.toLowerCase().includes(textoBusqueda);

    return cumpleEstado && cumpleBusqueda;
  });

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>
            GR <span style={{ color: '#E50914' }}>CRM & CLIENTES</span>
          </span>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>
            Volver al Panel
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '25px 20px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '10px' }}>Base de Clientes & Historial</h2>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>
          Gestión inteligente de contactos, búsquedas rápidas y seguimiento post-venta por WhatsApp.
        </p>

        {/* BUSCADOR */}
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="🔍 Buscar cliente por nombre, teléfono o correo..."
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

        {/* FILTROS */}
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
            ⏳ Pendientes ({clientes.filter((c) => !c.contactado).length})
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
            ✅ Contactados ({clientes.filter((c) => c.contactado).length})
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>Cargando datos de Firebase...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: clienteSeleccionado ? '1.2fr 1fr' : '1fr', gap: '20px' }}>
            
            {/* LISTA DE CLIENTES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {clientesFiltrados.length === 0 ? (
                <p style={{ color: '#888', background: '#141414', padding: '20px', borderRadius: '8px', border: '1px solid #222', textAlign: 'center' }}>
                  No se encontraron clientes.
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
                      justify: 'space-between',
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
                      <p style={{ margin: '2px 0', fontSize: '12px', color: '#AAA' }}>✉️ Correo: {cliente.email}</p>
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

            {/* DETALLES DE COMPRAS */}
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
                  <p style={{ margin: '3px 0' }}><strong>📞 Teléfono:</strong> {clienteSeleccionado.telefono}</p>
                  <p style={{ margin: '3px 0' }}><strong>✉️ Correo:</strong> {clienteSeleccionado.email}</p>
                  <p style={{ margin: '3px 0' }}><strong>📍 Dirección:</strong> {clienteSeleccionado.direccion}</p>
                  <p style={{ margin: '3px 0', color: '#25D366' }}>
                    <strong>Total acumulado:</strong> RD$ {clienteSeleccionado.totalInvertido.toLocaleString()}
                  </p>
                </div>

                <h4 style={{ fontSize: '13px', color: '#AAA', marginBottom: '10px' }}>Órdenes Registradas:</h4>
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
