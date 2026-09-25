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
      
      {/* Header / Navbar sin enlace admin público */}
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
                style={{ backgroundColor: '#25D366', color: '#FFF', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginTop: '10px' }}
              >
                {enviando ? 'Procesando Orden...' : 'Confirmar y Enviar Pedido'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Botones Flotantes de Contacto (WhatsApp, Instagram) */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 40 }}>
        <a
          href="https://wa.me/18494040514"
          target="_blank"
          rel="noopener noreferrer"
          style={{ backgroundColor: '#25D366', color: '#FFF', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: '24px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}
          title="Contactar por WhatsApp"
        >
          📲
        </a>

        <a
          href="https://www.instagram.com/gr.autoadorno/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ backgroundColor: '#E1306C', color: '#FFF', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}
          title="Instagram"
        >
          📷
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
