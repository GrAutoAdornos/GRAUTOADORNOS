// pages/index.js
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Home() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaSel, setCategoriaSel] = useState('Todos');
  const [busqueda, setBusqueda] = useState('');
  
  // Carrito y Checkout
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  // Formulario Checkout
  const [cliente, setCliente] = useState({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    metodoPago: 'Transferencia Bancaria',
    requiereInstalacion: false,
    fechaCita: '',
    horaCita: ''
  });

  // Control de horarios ocupados
  const [citasOcupadas, setCitasOcupadas] = useState([]);
  const [loadingCitas, setLoadingCitas] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    cargarProductos();
  }, []);

  const cargarProductos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'productos'));
      const docs = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setProductos(docs);
    } catch (error) {
      console.error("Error al cargar productos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Carrito Handlers
  const addToCart = (prod) => {
    setCart((prevCart) => {
      const itemExist = prevCart.find((item) => item.id === prod.id);
      if (itemExist) {
        return prevCart.map((item) =>
          item.id === prod.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prevCart, { ...prod, cantidad: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateCantidad = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nuevaCant = item.cantidad + delta;
            return nuevaCant > 0 ? { ...item, cantidad: nuevaCant } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const totalCart = cart.reduce((acc, item) => acc + (Number(item.precio) || 0) * item.cantidad, 0);
  const tieneProductoInstalable = cart.some((item) => item.permiteInstalacion || item.categoria === 'Iluminación' || item.categoria === 'Audio');

  // Filtro de productos por categoría y buscador
  const productosFiltrados = productos.filter((p) => {
    const coincideCat = categoriaSel === 'Todos' || p.categoria === categoriaSel;
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return coincideCat && coincideBusqueda;
  });

  // Validar y cargar citas de la fecha seleccionada
  const handleFechaChange = async (e) => {
    const fecha = e.target.value;
    if (!fecha) return;

    const selectedDate = new Date(fecha + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Debe ser Sábado (day 6)
    if (selectedDate.getDay() !== 6) {
      alert("Las instalaciones a domicilio solo se realizan los días sábados.");
      setCliente((prev) => ({ ...prev, fechaCita: '', horaCita: '' }));
      return;
    }

    // Debe ser a partir del próximo sábado (mínimo 7 días)
    const diffTime = selectedDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      alert("Por favor selecciona un sábado a partir de la próxima semana.");
      setCliente((prev) => ({ ...prev, fechaCita: '', horaCita: '' }));
      return;
    }

    setCliente((prev) => ({ ...prev, fechaCita: fecha, horaCita: '' }));
    setLoadingCitas(true);

    try {
      const q = query(collection(db, 'pedidos'), where('fechaCita', '==', fecha));
      const querySnapshot = await getDocs(q);
      const horasOcupadas = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.horaCita) horasOcupadas.push(data.horaCita);
      });
      setCitasOcupadas(horasOcupadas);
    } catch (err) {
      console.error("Error al consultar citas:", err);
    } finally {
      setLoadingCitas(false);
    }
  };

  const handleFinalizarPedido = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert("Tu carrito está vacío.");
    if (cliente.requiereInstalacion && (!cliente.fechaCita || !cliente.horaCita)) {
      return alert("Por favor selecciona la fecha y hora disponible para tu cita de instalación.");
    }

    setEnviando(true);
    const orderId = 'GR-' + Math.floor(100000 + Math.random() * 900000);
    const cartSummary = cart.map((i) => `${i.nombre} (x${i.cantidad})`).join(', ');

    // Bloques HTML dinámicos para la plantilla de EmailJS
    const bloqueCitaHTML = cliente.requiereInstalacion
      ? `<div style="background-color: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #e63946;">
          <h3 style="color: #ffffff; margin-top: 0; font-size: 15px;">📅 CITA DE INSTALACIÓN A DOMICILIO</h3>
          <p style="margin: 4px 0; color: #dddddd; font-size: 14px;"><strong>Fecha:</strong> ${cliente.fechaCita}</p>
          <p style="margin: 4px 0; color: #dddddd; font-size: 14px;"><strong>Hora:</strong> ${cliente.horaCita}</p>
         </div>`
      : '';

    const bloqueBancosHTML = `
      <div style="background-color: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #e63946;">
        <h3 style="color: #ffffff; margin-top: 0; font-size: 15px;">💳 CUENTAS BANCARIAS PARA TRANSFERENCIA / RESERVA ($150 USD)</h3>
        <p style="margin: 4px 0; font-size: 13px; color: #cccccc;">• <strong>Banco Popular DOP:</strong> Cta. Ahorros N° 814423729</p>
        <p style="margin: 4px 0; font-size: 13px; color: #cccccc;">• <strong>Banreservas DOP:</strong> Cta. Corriente N° 9605170252</p>
        <p style="margin: 4px 0; font-size: 13px; color: #cccccc;">• <strong>BHD DOP:</strong> Cta. Corriente N° 39485910015</p>
        <p style="margin: 4px 0; font-size: 13px; color: #cccccc;">• <strong>Zelle USD:</strong> Landra2916@gmail.com</p>
        <p style="margin: 8px 0 0; font-size: 12px; color: #aaaaaa;">* Titular: Landra Guzman, Freddy Rodriguez. Favor enviar el comprobante vía WhatsApp.</p>
      </div>`;

    const pedidoData = {
      orderId,
      clienteNombre: cliente.nombre,
      clienteTelefono: cliente.telefono,
      clienteEmail: cliente.email,
      direccion: cliente.direccion,
      metodoPago: cliente.metodoPago,
      detalles: cartSummary,
      total: totalCart,
      requiereInstalacion: cliente.requiereInstalacion,
      fechaCita: cliente.fechaCita || null,
      horaCita: cliente.horaCita || null,
      estado: 'Pendiente',
      fechaCreacion: new Date().toISOString()
    };

    try {
      // 1. Guardar pedido en Firestore
      await addDoc(collection(db, 'pedidos'), pedidoData);

      // 2. Enviar correo usando EmailJS vía API REST
      const emailPayload = {
        service_id: 'service_jfx0g2e',
        template_id: 'template_mhdgbsw',
        user_id: 'gFYWXFr3j_woisLA-',
        template_params: {
          user_name: cliente.nombre,
          order_id: orderId,
          cart_summary: cartSummary,
          total_price: `RD$ ${totalCart}`,
          metodo_pago: cliente.metodoPago,
          direccion: cliente.direccion,
          bloque_cita: bloqueCitaHTML,
          bloque_bancos: bloqueBancosHTML,
          to_email: cliente.email
        }
      };

      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload)
      });

      // 3. Redirigir a WhatsApp
      const mensajeWA = `Hola GR Auto Adornos, realicé el Pedido #${orderId}%0A%0A*Cliente:* ${cliente.nombre}%0A*Total:* RD$ ${totalCart}%0A*Dirección:* ${cliente.direccion}${cliente.requiereInstalacion ? `%0A*Cita Instalación:* ${cliente.fechaCita} a las${cliente.horaCita}` : ''}`;
      window.open(`https://wa.me/18494040514?text=${mensajeWA}`, '_blank');

      alert("¡Pedido realizado con éxito! Te hemos enviado un correo con los detalles.");
      setCart([]);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      setCliente({
        nombre: '',
        telefono: '',
        email: '',
        direccion: '',
        metodoPago: 'Transferencia Bancaria',
        requiereInstalacion: false,
        fechaCita: '',
        horaCita: ''
      });
    } catch (error) {
      console.error("Error al procesar el pedido:", error);
      alert("Ocurrió un error al procesar la orden. Por favor intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* Header / Navbar */}
      <header style={{ backgroundColor: '#000000', borderBottom: '2px solid #E50914', padding: '15px 20px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src="/LOGO NEGRO.jpeg" 
              alt="GR Auto Adornos Logo" 
              style={{ height: '45px', borderRadius: '6px', objectFit: 'contain' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <span style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '1px' }}>
              GR <span style={{ color: '#E50914' }}>AUTO ADORNOS</span>
            </span>
          </div>

          {/* Botón Carrito */}
          <button 
            onClick={() => setIsCartOpen(true)}
            style={{ backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            🛒 Carrito ({cart.reduce((a, c) => a + c.cantidad, 0)})
          </button>
        </div>
      </header>

      {/* Hero Banner */}
      <section style={{ backgroundColor: '#141414', padding: '40px 20px', textAlign: 'center', borderBottom: '1px solid #222' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ backgroundColor: '#3b0000', color: '#ff4d4d', border: '1px solid #E50914', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Accesorios e Instalación a Domicilio
          </span>
          <h1 style={{ fontSize: '28px', fontWeight: '900', margin: '15px 0 10px', textTransform: 'uppercase' }}>
            Equipa tu vehículo con la mejor tecnología
          </h1>
          <p style={{ color: '#AAAAAA', fontSize: '13px', maxWidth: '600px', margin: '0 auto' }}>
            Pantallas, cámaras de reversa, iluminación LED, sistemas de audio y tintados instalados directo en tu puerta.
          </p>
        </div>
      </section>

      {/* Buscador y Filtros */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>
        
        {/* Barra de Búsqueda */}
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <input
            type="text"
            placeholder="🔍 Buscar producto (ej. cámara trasera, pantalla, radio)..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: '100%', maxWidth: '500px', backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
          />
        </div>

        {/* Categorías */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '30px' }}>
          {['Todos', 'Accesorios', 'Iluminación', 'Audio', 'Pantallas & Cámaras', 'Tintados'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaSel(cat)}
              style={{
                backgroundColor: categoriaSel === cat ? '#E50914' : '#1A1A1A',
                color: '#FFFFFF',
                border: categoriaSel === cat ? '1px solid #E50914' : '1px solid #333',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Listado de Productos */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>Cargando accesorios...</div>
        ) : productosFiltrados.length === 0 ? (
          <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#888' }}>
            No se encontraron productos coincidentes.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
            {productosFiltrados.map((prod) => (
              <div key={prod.id} style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <img 
                    src={prod.imagenUrl} 
                    alt={prod.nombre} 
                    style={{ width: '100%', height: '180px', objectFit: 'cover', backgroundColor: '#000' }}
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=GR+Auto+Adornos'; }}
                  />
                  <div style={{ padding: '15px' }}>
                    <span style={{ fontSize: '10px', backgroundColor: '#222', color: '#DDD', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                      {prod.categoria}
                    </span>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '8px 0', color: '#FFF' }}>{prod.nombre}</h3>
                    <p style={{ fontSize: '18px', fontWeight: '900', color: '#E50914', margin: '0' }}>RD$ {prod.precio}</p>
                  </div>
                </div>

                <div style={{ padding: '15px', paddingTop: '0' }}>
                  <button
                    onClick={() => addToCart(prod)}
                    style={{ width: '100%', backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                  >
                    + Agregar al Carrito
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Carrito Lateral */}
      {isCartOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ backgroundColor: '#141414', width: '100%', maxWidth: '400px', height: '100%', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFF' }}>Tu Carrito de Compras</h2>
                <button onClick={() => setIsCartOpen(false)} style={{ backgroundColor: 'transparent', color: '#888', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
              </div>

              {cart.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>El carrito está vacío.</p>
              ) : (
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '60vh', overflowY: 'auto' }}>
                  {cart.map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1F1F1F', padding: '10px', borderRadius: '8px' }}>
                      <div>
                        <h4 style={{ fontSize: '13px', margin: '0', color: '#FFF' }}>{item.nombre}</h4>
                        <p style={{ fontSize: '12px', color: '#E50914', margin: '2px 0 0', fontWeight: 'bold' }}>RD$ {item.precio}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={() => updateCantidad(item.id, -1)} style={{ backgroundColor: '#333', color: '#FFF', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>-</button>
                        <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{item.cantidad}</span>
                        <button onClick={() => updateCantidad(item.id, 1)} style={{ backgroundColor: '#333', color: '#FFF', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                        <button onClick={() => removeFromCart(item.id)} style={{ backgroundColor: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', marginLeft: '5px' }}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>
                  <span>Total:</span>
                  <span style={{ color: '#E50914' }}>RD$ {totalCart}</span>
                </div>
                <button
                  onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                  style={{ width: '100%', backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
                >
                  Continuar al Pago
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Checkout */}
      {isCheckoutOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 50, overflowY: 'auto', padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#141414', border: '1px solid #333', borderRadius: '12px', width: '100%', maxWidth: '600px', padding: '25px', position: 'relative' }}>
            <button onClick={() => setIsCheckoutOpen(false)} style={{ position: 'absolute', top: '15px', right: '15px', backgroundColor: 'transparent', color: '#888', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#E50914', marginBottom: '15px' }}>Completar Pedido</h2>

            <form onSubmit={handleFinalizarPedido} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#AAA' }}>Nombre Completo *</label>
                <input required type="text" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} style={{ width: '100%', backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#AAA' }}>Teléfono / WhatsApp *</label>
                  <input required type="tel" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} style={{ width: '100%', backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#AAA' }}>Correo Electrónico *</label>
                  <input required type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} style={{ width: '100%', backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#AAA' }}>Dirección Completa de Entrega *</label>
                <input required type="text" value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} style={{ width: '100%', backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }} />
              </div>

              {/* Opción de Cita de Instalación a Domicilio */}
              {tieneProductoInstalable && (
                <div style={{ backgroundColor: '#1A1A1A', border: '1px solid #333', padding: '12px', borderRadius: '8px', marginTop: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#FFF', fontWeight: 'bold' }}>
                    <input type="checkbox" checked={cliente.requiereInstalacion} onChange={(e) => setCliente({ ...cliente, requiereInstalacion: e.target.checked })} />
                    ¿Deseas servicio de instalación a domicilio?
                  </label>

                  {cliente.requiereInstalacion && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <p style={{ fontSize: '11px', color: '#ff4d4d', margin: '0' }}>* Instalaciones exclusivamente los sábados (A partir de la próxima semana).</p>
                      
                      <div>
                        <label style={{ fontSize: '11px', color: '#AAA' }}>Seleccionar Sábado *</label>
                        <input type="date" value={cliente.fechaCita} onChange={handleFechaChange} style={{ width: '100%', backgroundColor: '#000', border: '1px solid #444', color: '#FFF', padding: '8px', borderRadius: '6px', fontSize: '12px' }} />
                      </div>

                      {cliente.fechaCita && (
                        <div>
                          <label style={{ fontSize: '11px', color: '#AAA' }}>Horario Disponible *</label>
                          {loadingCitas ? (
                            <p style={{ fontSize: '11px', color: '#888' }}>Consultando agenda...</p>
                          ) : (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                              <button
                                type="button"
                                disabled={citasOcupadas.includes('1:00 PM')}
                                onClick={() => setCliente({ ...cliente, horaCita: '1:00 PM' })}
                                style={{
                                  flex: 1,
                                  backgroundColor: citasOcupadas.includes('1:00 PM') ? '#333' : cliente.horaCita === '1:00 PM' ? '#E50914' : '#222',
                                  color: citasOcupadas.includes('1:00 PM') ? '#666' : '#FFF',
                                  border: '1px solid #444',
                                  padding: '8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  cursor: citasOcupadas.includes('1:00 PM') ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {citasOcupadas.includes('1:00 PM') ? '1:00 PM (Ocupado)' : '1:00 PM'}
                              </button>

                              <button
                                type="button"
                                disabled={citasOcupadas.includes('4:00 PM')}
                                onClick={() => setCliente({ ...cliente, horaCita: '4:00 PM' })}
                                style={{
                                  flex: 1,
                                  backgroundColor: citasOcupadas.includes('4:00 PM') ? '#333' : cliente.horaCita === '4:00 PM' ? '#E50914' : '#222',
                                  color: citasOcupadas.includes('4:00 PM') ? '#666' : '#FFF',
                                  border: '1px solid #444',
                                  padding: '8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  cursor: citasOcupadas.includes('4:00 PM') ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {citasOcupadas.includes('4:00 PM') ? '4:00 PM (Ocupado)' : '4:00 PM'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Información Cuentas Bancarias */}
              <div style={{ backgroundColor: '#181818', border: '1px solid #333', padding: '12px', borderRadius: '8px', fontSize: '11px', color: '#CCC' }}>
                <p style={{ fontWeight: 'bold', color: '#FFF', margin: '0 0 5px' }}>CUENTAS BANCARIAS PARA TRANSFERENCIA / RESERVA ($150 USD):</p>
                <p style={{ margin: '2px 0' }}>• Banco Popular DOP: Cta. Ahorros N° 814423729</p>
                <p style={{ margin: '2px 0' }}>• Banreservas DOP: Cta. Corriente N° 9605170252</p>
                <p style={{ margin: '2px 0' }}>• BHD DOP: Cta. Corriente N° 39485910015</p>
                <p style={{ margin: '2px 0' }}>• Zelle USD: Landra2916@gmail.com</p>
                <p style={{ margin: '5px 0 0', color: '#AAA' }}>* Titular: Landra Guzman, Freddy Rodriguez. Enviar comprobante vía WhatsApp.</p>
              </div>

              <button
                type="submit"
                disabled={enviando}
                style={{ backgroundColor: '#25D366', color: '#FFF', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M12.031 2c-5.514 0-9.98 4.466-9.98 9.98 0 1.76.459 3.479 1.33 4.996L2 22l5.141-1.348c1.465.799 3.12 1.22 4.89 1.22 5.514 0 9.98-4.466 9.98-9.98 0-5.514-4.466-9.98-9.98-9.98zm0 18.254c-1.57 0-3.111-.421-4.46-1.218l-.32-.189-3.315.869.885-3.232-.209-.333c-.878-1.399-1.341-3.023-1.341-4.691 0-4.708 3.83-8.538 8.538-8.538 4.708 0 8.538 3.83 8.538 8.538 0 4.708-3.83 8.538-8.538 8.538z"/>
                </svg>
                {enviando ? 'Procesando Orden...' : 'Confirmar y Enviar Pedido'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Botones Flotantes Oficiales de Contacto (WhatsApp, Instagram) */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 40 }}>
        
        {/* Ícono Oficial de WhatsApp */}
        <a
          href="https://wa.me/18494040514"
          target="_blank"
          rel="noopener noreferrer"
          style={{ backgroundColor: '#25D366', color: '#FFF', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', transition: 'transform 0.2s' }}
          title="Contactar por WhatsApp"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
          </svg>
        </a>

        {/* Ícono Oficial de Instagram */}
        <a
          href="https://www.instagram.com/gr.autoadorno/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%,#d6249f 60%,#285AEB 90%)', color: '#FFF', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', transition: 'transform 0.2s' }}
          title="Instagram"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </a>

      </div>

      {/* Footer */}
      <footer style={{ backgroundColor: '#000000', borderTop: '1px solid #222', padding: '25px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
        <p style={{ margin: '0 0 5px' }}>📍 Correo: <a href="mailto:grautoadornos@gmail.com" style={{ color: '#AAA', textDecoration: 'none' }}>grautoadornos@gmail.com</a> | WhatsApp: 849-404-0514</p>
        <p style={{ margin: 0 }}>© 2026 GR Auto Adornos. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
