// pages/admin/pedidos.js
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function HistorialPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  // Estados para el Modal de Crear Pedido Manual
  const [mostrarModal, setMostrarModal] = useState(false);
  const [productosInventario, setProductosInventario] = useState([]);
  
  // Vendedores registrados
  const [listaVendedores, setListaVendedores] = useState([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState('');

  // Selección de Tipo de Cliente (Nuevo vs Existente)
  const [tipoCliente, setTipoCliente] = useState('nuevo');
  const [listaClientesCRM, setListaClientesCRM] = useState([]);
  const [clienteExistenteSeleccionado, setClienteExistenteSeleccionado] = useState('');

  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [correoCliente, setCorreoCliente] = useState('');
  const [direccionCliente, setDireccionCliente] = useState('');
  
  // Zonas de Envío
  const zonasEnvio = [
    { nombre: 'Distrito Nacional / Centro', costo: 250 },
    { nombre: 'Santo Domingo Oeste (Herrera)', costo: 200 },
    { nombre: 'Santo Domingo Este', costo: 350 },
    { nombre: 'Santo Domingo Oeste', costo: 300 },
    { nombre: 'Santo Domingo Norte', costo: 400 },
    { nombre: 'Retirar en Tienda (Sin Envíos)', costo: 0 }
  ];
  const [zonaSeleccionada, setZonaSeleccionada] = useState(zonasEnvio[0]);

  // Método de Pago
  const [metodoPago, setMetodoPago] = useState('Pago Contra Entrega');

  // Ítems seleccionados (se manejan como unidades físicas individuales)
  const [itemsSeleccionados, setItemsSeleccionados] = useState([]);
  const [guardandoPedido, setGuardandoPedido] = useState(false);

  // Estado para la Factura Imprimible
  const [facturaParaImprimir, setFacturaParaImprimir] = useState(null);

  useEffect(() => {
    cargarPedidos();
    cargarInventario();
    cargarVendedores();
  }, []);

  // Validación de día SÁBADO
  const esSabado = (fechaString) => {
    if (!fechaString) return false;
    const fecha = new Date(`${fechaString}T00:00:00`);
    return fecha.getDay() === 6;
  };

  const cargarVendedores = async () => {
    try {
      const snap = await getDocs(collection(db, 'vendedores'));
      const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListaVendedores(lista);
    } catch (error) {
      console.error("Error al cargar vendedores:", error);
    }
  };

  const cargarPedidos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'pedidos'));
      const list = [];
      const mapaClientes = {};

      querySnapshot.forEach((documento) => {
        const data = documento.data();
        list.push({ id: documento.id, ...data });

        const nombre = data.clienteNombre || 
                       (typeof data.cliente === 'object' && data.cliente !== null ? data.cliente.nombre : data.cliente) || 
                       'Cliente Sin Nombre';

        const tel = data.clienteTelefono || 
                    data.telefono || 
                    data.phone || 
                    data.celular || 
                    (typeof data.cliente === 'object' && data.cliente !== null ? data.cliente.telefono : 'Sin Teléfono');

        const email = data.clienteEmail || 
                      data.correo || 
                      data.email || 
                      (typeof data.cliente === 'object' && data.cliente !== null ? data.cliente.email : '');

        const dir = data.direccion || 
                    (typeof data.cliente === 'object' && data.cliente !== null ? data.cliente.direccion : '');

        const clave = tel !== 'Sin Teléfono' ? tel : nombre;

        if (clave && clave !== 'Cliente Sin Nombre' && !mapaClientes[clave]) {
          mapaClientes[clave] = {
            idClave: clave,
            nombre: nombre,
            telefono: tel,
            correo: email,
            direccion: dir
          };
        }
      });

      setPedidos(list);
      setListaClientesCRM(Object.values(mapaClientes));
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const cargarInventario = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'productos'));
      const list = [];
      querySnapshot.forEach((documento) => {
        list.push({ id: documento.id, ...documento.data() });
      });
      setProductosInventario(list);
    } catch (error) {
      console.error("Error al cargar inventario:", error);
    }
  };

  const handleSeleccionarClienteExistente = (clave) => {
    setClienteExistenteSeleccionado(clave);
    if (!clave) {
      setNombreCliente('');
      setTelefonoCliente('');
      setCorreoCliente('');
      setDireccionCliente('');
      return;
    }

    const clienteEncontrado = listaClientesCRM.find((c) => c.idClave === clave);
    if (clienteEncontrado) {
      setNombreCliente(clienteEncontrado.nombre);
      setTelefonoCliente(clienteEncontrado.telefono !== 'Sin Teléfono' ? clienteEncontrado.telefono : '');
      setCorreoCliente(clienteEncontrado.correo);
      setDireccionCliente(clienteEncontrado.direccion !== 'Dirección no registrada' ? clienteEncontrado.direccion : '');
    }
  };

  const handleEliminarPedido = async (id, orderId) => {
    const confirmar = window.confirm(`¿Estás seguro de que deseas eliminar la orden #${orderId}?`);
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, 'pedidos', id));
      setPedidos((prev) => prev.filter((item) => item.id !== id));
      alert(`Orden #${orderId} eliminada correctamente.`);
    } catch (error) {
      console.error("Error al eliminar pedido:", error);
    }
  };

  const handleCambiarEstado = async (id, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'pedidos', id), { estado: nuevoEstado });
      setPedidos((prev) =>
        prev.map((item) => (item.id === id ? { ...item, estado: nuevoEstado } : item))
      );
    } catch (error) {
      console.error("Error al cambiar estado:", error);
    }
  };

  // Agregar 1 unidad individual al pedido
  const agregarProductoAlPedido = (producto) => {
    const unidadesExistentes = itemsSeleccionados.filter(i => i.productoId === producto.id).length;
    const stockDisponible = producto.stock ?? 99;

    if (unidadesExistentes >= stockDisponible) {
      alert("No hay suficiente stock disponible para agregar otra unidad.");
      return;
    }

    const nuevaUnidad = {
      instanceId: `${producto.id}_${Date.now()}_${Math.random()}`,
      productoId: producto.id,
      nombre: producto.nombre || producto.titulo,
      precio: Number(producto.precio || producto.price || 0),
      requiereInstalacion: false,
      costoInstalacion: Number(producto.precioInstalacion || 0),
      fechaCita: '',
      horaCita: ''
    };

    setItemsSeleccionados((prev) => [...prev, nuevaUnidad]);
  };

  // Eliminar una unidad física específica
  const eliminarUnidad = (instanceId) => {
    setItemsSeleccionados((prev) => prev.filter((item) => item.instanceId !== instanceId));
  };

  // Actualizar la instalación de una unidad específica
  const actualizarItemInstalacion = (instanceId, campo, valor) => {
    setItemsSeleccionados((prev) =>
      prev.map((item) => {
        if (item.instanceId === instanceId) {
          return { ...item, [campo]: valor };
        }
        return item;
      })
    );
  };

  // Cálculos dinámicos
  const subtotalProductos = itemsSeleccionados.reduce((acc, item) => acc + item.precio, 0);
  const totalInstalaciones = itemsSeleccionados.reduce((acc, item) => acc + (item.requiereInstalacion ? Number(item.costoInstalacion || 0) : 0), 0);
  
  // Si al menos un ítem requiere instalación, el envío es GRATIS (RD$ 0)
  const hayInstalacion = itemsSeleccionados.some(item => item.requiereInstalacion);
  const costoEnvioCalculado = hayInstalacion ? 0 : zonaSeleccionada.costo;
  const totalGeneral = subtotalProductos + totalInstalaciones + costoEnvioCalculado;

const handleCrearPedidoManual = async (e) => {
    e.preventDefault();
    if (!nombreCliente || !telefonoCliente || itemsSeleccionados.length === 0) {
      alert("Por favor completa el nombre, teléfono y selecciona al menos un producto.");
      return;
    }

    // Validar ítems con instalación
    const itemsConInstalacion = itemsSeleccionados.filter(item => item.requiereInstalacion);
    for (const item of itemsConInstalacion) {
      if (!item.fechaCita || !item.horaCita) {
        alert(`Por favor selecciona la fecha y hora de instalación para la unidad de: ${item.nombre}`);
        return;
      }
      if (!esSabado(item.fechaCita)) {
        alert(`La fecha de instalación para "${item.nombre}" debe ser un SÁBADO.`);
        return;
      }
    }

    setGuardandoPedido(true);
    try {
      // Validar límite de 2 instalaciones por sábado
      if (itemsConInstalacion.length > 0) {
        const mapaFechasNuevas = {};
        itemsConInstalacion.forEach(i => {
          mapaFechasNuevas[i.fechaCita] = (mapaFechasNuevas[i.fechaCita] || 0) + 1;
        });

        for (const fecha of Object.keys(mapaFechasNuevas)) {
          let totalExistentes = 0;
          pedidos.forEach(p => {
            if (p.itemsDetalle) {
              p.itemsDetalle.forEach(it => {
                if (it.requiereInstalacion && it.fechaCita === fecha) {
                  totalExistentes += 1;
                }
              });
            } else if (p.requiereInstalacion && p.fechaCita === fecha) {
              totalExistentes += 1;
            }
          });

          if (totalExistentes + mapaFechasNuevas[fecha] > 2) {
            alert(`Capacidad máxima alcanzada para el sábado ${fecha}. Ya hay ${totalExistentes} instalaciones agendadas y solo se permiten 2 por sábado.`);
            setGuardandoPedido(false);
            return;
          }
        }
      }

      const orderId = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Agrupar ítems para un resumen de texto comprensible
      const detallesTexto = itemsSeleccionados.map((i, index) => {
        let txt = `1x ${i.nombre}`;
        if (i.requiereInstalacion) txt += ` (Instalación Cita #${index + 1}: ${i.fechaCita} @ ${i.horaCita})`;
        return txt;
      }).join(', ');

      // Obtener datos del vendedor asignado
      const vendedorObj = listaVendedores.find(v => v.id === vendedorSeleccionado);
      const porcentajeComision = vendedorObj ? Number(vendedorObj.porcentajeDefecto || 5) : 0;
      const montoComision = (subtotalProductos * porcentajeComision) / 100;

      // Agrupar conteo por ID para descontar stock en Firebase
      const mapaStockADescontar = {};
      itemsSeleccionados.forEach(i => {
        mapaStockADescontar[i.productoId] = (mapaStockADescontar[i.productoId] || 0) + 1;
      });

      const datosPedido = {
        orderId: orderId,
        clienteNombre: nombreCliente,
        cliente: nombreCliente,
        telefono: telefonoCliente,
        correo: correoCliente || 'No especificado',
        direccion: direccionCliente || zonaSeleccionada.nombre,
        zonaEnvio: zonaSeleccionada.nombre,
        costoEnvio: costoEnvioCalculado,
        subtotalProductos: subtotalProductos,
        totalInstalaciones: totalInstalaciones,
        detalles: detallesTexto,
        itemsDetalle: itemsSeleccionados,
        total: totalGeneral,
        metodoPago: metodoPago,
        estado: 'Pendiente',
        fidelizacionContactado: false,
        fecha: new Date(),
        origen: 'Manual (WhatsApp/Llamada)',
        requiereInstalacion: hayInstalacion,
        
        // Comisión Vendedor
        vendedorId: vendedorObj ? vendedorObj.id : null,
        vendedorNombre: vendedorObj ? vendedorObj.nombre : 'Sin Asignar',
        vendedorPorcentaje: porcentajeComision,
        porcentajeComisionVendedor: porcentajeComision,
        montoComisionVendedor: montoComision
      };

      // ✅ TRANSACCIÓN CORREGIDA
      await runTransaction(db, async (transaction) => {
        const idsProductos = Object.keys(mapaStockADescontar);
        const lecturasProductos = [];

        // PASO 1: EJECUTAR TODAS LAS LECTURAS (READS) PRIMERO
        for (const prodId of idsProductos) {
          const prodRef = doc(db, 'productos', prodId);
          const prodDoc = await transaction.get(prodRef);
          
          if (!prodDoc.exists()) {
            throw new Error(`El producto seleccionado (ID: ${prodId}) ya no existe.`);
          }
          
          const stockActual = Number(prodDoc.data().stock ?? 0);
          const cantidadPedida = mapaStockADescontar[prodId];

          if (stockActual < cantidadPedida) {
            throw new Error(`Stock insuficiente para "${prodDoc.data().nombre || prodDoc.data().titulo}". Stock actual: ${stockActual}, solicitado: ${cantidadPedida}`);
          }

          lecturasProductos.push({
            ref: prodRef,
            nuevoStock: stockActual - cantidadPedida
          });
        }

        // PASO 2: EJECUTAR TODAS LAS ESCRITURAS (WRITES) AL FINAL
        for (const item of lecturasProductos) {
          transaction.update(item.ref, { stock: item.nuevoStock });
        }

        const nuevoPedidoRef = doc(collection(db, 'pedidos'));
        transaction.set(nuevoPedidoRef, datosPedido);
      });

      setMostrarModal(false);
      setFacturaParaImprimir(datosPedido);

      // Limpiar formulario
      setTipoCliente('nuevo');
      setClienteExistenteSeleccionado('');
      setNombreCliente('');
      setTelefonoCliente('');
      setCorreoCliente('');
      setDireccionCliente('');
      setItemsSeleccionados([]);
      setVendedorSeleccionado('');
      
      cargarPedidos();
      cargarInventario();
    } catch (error) {
      console.error("Error al crear pedido:", error);
      alert("Error: " + error.message);
    } finally {
      setGuardandoPedido(false);
    }
  };

  const pedidosFiltrados = pedidos.filter((p) => {
    if (filtroEstado === 'Todos') return true;
    return p.estado === filtroEstado;
  });

  // CÁLCULO DE CONTADORES
  const totalPendientes = pedidos.filter((p) => p.estado === 'Pendiente').length;
  const totalCompletados = pedidos.filter((p) => p.estado === 'Completado' || p.estado === 'Completada').length;
  const totalCancelados = pedidos.filter((p) => p.estado === 'Cancelado' || p.estado === 'Cancelada').length;

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', padding: '30px 20px', fontFamily: 'sans-serif' }}>
      
      {/* CSS PARA IMPRESIÓN DE FACTURA */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #seccion-impresion-factura, #seccion-impresion-factura * {
            visibility: visible;
          }
          #seccion-impresion-factura {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #FFF !important;
            color: #000 !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E50914', paddingBottom: '15px', marginBottom: '25px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#E50914', textTransform: 'uppercase', margin: 0 }}>
          GR Pedidos & Facturas
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => window.location.href = '/admin/comisiones-vendedores'}
            style={{
              backgroundColor: '#000000',
              color: '#FFF',
              border: '2px solid #E50914',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#E50914';
              e.currentTarget.style.color = '#FFF';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#000000';
              e.currentTarget.style.color = '#FFF';
            }}
          >
             Comisiones Vendedores
          </button>
          <button
            onClick={() => setMostrarModal(true)}
            style={{ backgroundColor: '#25D366', color: '#000', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
             Nuevo Pedido Manual
          </button>
          <button
            onClick={() => window.print()}
            style={{ backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
             Exportar Reporte de Ventas (PDF)
          </button>
          <button onClick={() => window.location.href = '/admin/dashboard'} style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            Volver al Panel
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* CONTADORES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '25px' }}>
          <div style={{ backgroundColor: '#141414', border: '1px solid #FFB800', borderRadius: '10px', padding: '15px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>Pendientes</span>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#FFB800' }}>{totalPendientes}</span>
          </div>

          <div style={{ backgroundColor: '#141414', border: '1px solid #25D366', borderRadius: '10px', padding: '15px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>Completadas</span>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#25D366' }}>{totalCompletados}</span>
          </div>

          <div style={{ backgroundColor: '#141414', border: '1px solid #E50914', borderRadius: '10px', padding: '15px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>Canceladas</span>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#E50914' }}>{totalCancelados}</span>
          </div>

          <div style={{ backgroundColor: '#141414', border: '1px solid #333', borderRadius: '10px', padding: '15px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Pedidos</span>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#FFF' }}>{pedidos.length}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>Historial de Pedidos</h2>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ backgroundColor: '#1A1A1A', color: '#FFF', border: '1px solid #333', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', outline: 'none' }}>
            <option value="Todos">Todos los Estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Completado">Completado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>Cargando pedidos...</p>
        ) : pedidosFiltrados.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px 0', backgroundColor: '#141414', borderRadius: '8px', border: '1px solid #222' }}>No hay pedidos registrados.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {pedidosFiltrados.map((pedido) => (
              <div key={pedido.id} style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#E50914', margin: 0 }}>
                      Orden #{pedido.orderId}
                    </h3>
                    <span style={{ backgroundColor: '#222', color: '#888', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #333' }}>
                      {pedido.origen || 'Web'}
                    </span>
                    {pedido.vendedorNombre && pedido.vendedorNombre !== 'Sin Asignar' && (
                      <span style={{ backgroundColor: '#1B2A4A', color: '#60A5FA', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #2563EB' }}>
                         Vendedor: {pedido.vendedorNombre}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <select
                      value={pedido.estado || 'Pendiente'}
                      onChange={(e) => handleCambiarEstado(pedido.id, e.target.value)}
                      style={{ backgroundColor: '#1A1A1A', color: '#FFB800', border: '1px solid #333', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Completado">Completado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>

                    <button
                      onClick={() => setFacturaParaImprimir(pedido)}
                      style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                       Ver Factura
                    </button>

                    <button
                      onClick={() => handleEliminarPedido(pedido.id, pedido.orderId)}
                      style={{ backgroundColor: '#330000', color: '#ff4d4d', border: '1px solid #ff4d4d', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                       Eliminar
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: '#DDD', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <p style={{ margin: 0 }}><strong>Cliente:</strong> {pedido.clienteNombre || pedido.cliente} ({pedido.telefono})</p>
                  <p style={{ margin: 0 }}><strong>Dirección / Zona:</strong> {pedido.direccion}</p>
                  <p style={{ margin: 0 }}><strong>Detalles:</strong> {pedido.detalles}</p>
                  <p style={{ margin: 0 }}><strong>Método de Pago:</strong> {pedido.metodoPago || 'Pago Contra Entrega'}</p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '900', color: '#25D366', marginTop: '4px' }}>
                    Total: RD$ {Number(pedido.total).toLocaleString()}
                  </p>
                </div>

                <div>
                  <button
                    onClick={() => {
                      const msg = ` *GR AUTO ADORNOS* - FACTURA DE PEDIDO\n\n` +
                                  `*Orden:* #${pedido.orderId}\n` +
                                  `*Cliente:* ${pedido.clienteNombre || pedido.cliente}\n` +
                                  `*Detalles:* ${pedido.detalles}\n` +
                                  `*Envío / Zona:* ${pedido.direccion}\n` +
                                  `*Método de Pago:* ${pedido.metodoPago || 'Pago Contra Entrega'}\n` +
                                  `*TOTAL A PAGAR:* RD$ ${Number(pedido.total).toLocaleString()}\n\n` +
                                  ` *CUENTAS BANCARIAS PARA TRANSFERENCIA:*\n` +
                                  `• Banco Popular DOP: Cta. Ahorros N° 814423729\n` +
                                  `• Banreservas DOP: Cta. Corriente N° 9605170252\n` +
                                  `• BHD DOP: Cta. Corriente N° 39485910015\n` +
                                  `• Zelle USD: Landra2916@gmail.com\n` +
                                  `*Titular:* Landra Guzman, Freddy Rodriguez\n\n` +
                                  `¡Gracias por preferirnos!`;
                      window.open(`https://wa.me/1${String(pedido.telefono || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    style={{ backgroundColor: '#25D366', color: '#000', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                     Enviar Factura (WhatsApp)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL CREAR PEDIDO MANUAL */}
      {mostrarModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000, padding: '20px', overflowY: 'auto'
        }}>
          <div style={{
            backgroundColor: '#141414', border: '1px solid #333', borderRadius: '12px',
            width: '100%', maxWidth: '700px', padding: '25px', maxHeight: '90vh', overflowY: 'auto', color: '#FFF'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="/LOGO NEGRO.jpeg" alt="Logo" style={{ width: '35px', height: '35px', objectFit: 'contain', borderRadius: '4px' }} onError={(e) => e.target.style.display = 'none'} />
                <h3 style={{ margin: 0, color: '#E50914', fontSize: '18px' }}>Registrar Pedido Manual</h3>
              </div>
              <button onClick={() => setMostrarModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCrearPedidoManual} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {/* ASIGNACIÓN DE VENDEDOR */}
              <div style={{ backgroundColor: '#1A1A1A', padding: '12px', borderRadius: '8px', border: '1px solid #2563EB' }}>
                <label style={{ fontSize: '12px', color: '#60A5FA', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                   Asignar Vendedor (Comisión):
                </label>
                <select
                  value={vendedorSeleccionado}
                  onChange={(e) => setVendedorSeleccionado(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#0D0D0D', border: '1px solid #2563EB', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                >
                  <option value="">-- Sin Vendedor Asignado --</option>
                  {listaVendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre} ({v.porcentajeDefecto || 5}% comisión)
                    </option>
                  ))}
                </select>
              </div>

              {/* SELECCIÓN DE CLIENTE */}
              <div style={{ backgroundColor: '#1A1A1A', padding: '12px', borderRadius: '8px', border: '1px solid #333' }}>
                <label style={{ fontSize: '12px', color: '#FFB800', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                   Selección de Cliente:
                </label>
                <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="radio"
                      name="tipoCliente"
                      value="nuevo"
                      checked={tipoCliente === 'nuevo'}
                      onChange={() => {
                        setTipoCliente('nuevo');
                        setClienteExistenteSeleccionado('');
                        setNombreCliente('');
                        setTelefonoCliente('');
                        setCorreoCliente('');
                        setDireccionCliente('');
                      }}
                    />
                    Cliente Nuevo
                  </label>
                  <label style={{ fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="radio"
                      name="tipoCliente"
                      value="existente"
                      checked={tipoCliente === 'existente'}
                      onChange={() => setTipoCliente('existente')}
                    />
                    Cliente Existente (CRM)
                  </label>
                </div>

                {tipoCliente === 'existente' && (
                  <div>
                    <select
                      value={clienteExistenteSeleccionado}
                      onChange={(e) => handleSeleccionarClienteExistente(e.target.value)}
                      style={{ width: '100%', backgroundColor: '#0D0D0D', border: '1px solid #FFB800', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                    >
                      <option value="">-- Selecciona un Cliente Registrado --</option>
                      {listaClientesCRM.map((c) => (
                        <option key={c.idClave} value={c.idClave}>
                          {c.nombre} ({c.telefono})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* CAMPOS CLIENTE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '5px' }}>Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Pérez"
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '5px' }}>Teléfono / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 8095551234"
                    value={telefonoCliente}
                    onChange={(e) => setTelefonoCliente(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '5px' }}>Correo Electrónico (Opcional)</label>
                <input
                  type="email"
                  placeholder="Ej. correo@gmail.com"
                  value={correoCliente}
                  onChange={(e) => setCorreoCliente(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '5px' }}>Dirección Completa de Entrega</label>
                <input
                  type="text"
                  placeholder="Ej. Calle Principal #12, Sector..."
                  value={direccionCliente}
                  onChange={(e) => setDireccionCliente(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              {/* ZONA DE ENVÍO */}
              <div>
                <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '5px' }}>Zona de Entrega / Municipio *</label>
                <select
                  value={JSON.stringify(zonaSeleccionada)}
                  onChange={(e) => setZonaSeleccionada(JSON.parse(e.target.value))}
                  style={{ width: '100%', backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }}
                >
                  {zonasEnvio.map((z, idx) => (
                    <option key={idx} value={JSON.stringify(z)}>
                      {z.nombre} - RD$ {z.costo}
                    </option>
                  ))}
                </select>
              </div>

              {/* MÉTODO DE PAGO */}
              <div>
                <label style={{ fontSize: '12px', color: '#AAA', display: 'block', marginBottom: '5px' }}>Método de Pago *</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }}
                >
                  <option value="Pago Contra Entrega">Pago Contra Entrega</option>
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                </select>
              </div>

              {/* SELECCIÓN DE PRODUCTOS */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#FFB800', display: 'block', marginBottom: '8px' }}>Seleccionar Productos del Inventario:</label>
                <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #222', borderRadius: '6px', padding: '8px', backgroundColor: '#0D0D0D', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {productosInventario.map((prod) => (
                    <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141414', padding: '8px', borderRadius: '4px', border: '1px solid #222' }}>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{prod.nombre || prod.titulo}</span>
                        <div style={{ fontSize: '11px', color: '#888' }}>Stock: {prod.stock ?? 0} | RD$ {Number(prod.precio || prod.price || 0).toLocaleString()}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => agregarProductoAlPedido(prod)}
                        style={{ backgroundColor: '#222', color: '#25D366', border: '1px solid #25D366', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        + Agregar Unidad
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* CARRITO Y CONFIGURACIÓN DE INSTALACIÓN INDIVIDUAL POR UNIDAD FÍSICA */}
              {itemsSeleccionados.length > 0 && (
                <div style={{ backgroundColor: '#1A1A1A', padding: '12px', borderRadius: '8px', border: '1px solid #333' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#FFF', display: 'block', marginBottom: '10px' }}>Unidades en el Pedido e Instalaciones Individuales:</label>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                    {itemsSeleccionados.map((item, index) => (
                      <div key={item.instanceId} style={{ backgroundColor: '#0D0D0D', padding: '10px', borderRadius: '6px', border: '1px solid #222' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#FFF' }}>
                            {item.nombre} <span style={{ color: '#E50914', fontSize: '11px' }}>(Unidad #{index + 1})</span>
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: '#25D366', fontWeight: 'bold' }}>RD$ {item.precio.toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => eliminarUnidad(item.instanceId)}
                              style={{ backgroundColor: '#330000', color: '#FF4D4D', border: '1px solid #FF4D4D', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              Quitar
                            </button>
                          </div>
                        </div>

                        {/* CHECKBOX DE INSTALACIÓN POR UNIDAD INDIVIDUAL */}
                        <div style={{ borderTop: '1px solid #222', paddingTop: '8px', marginTop: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#FFB800', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={item.requiereInstalacion || false}
                              onChange={(e) => actualizarItemInstalacion(item.instanceId, 'requiereInstalacion', e.target.checked)}
                            />
                            ¿Esta unidad requiere instalación?
                          </label>

                          {item.requiereInstalacion && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
                              <div>
                                <label style={{ fontSize: '10px', color: '#AAA', display: 'block' }}>Costo Instalación (RD$)</label>
                                <input
                                  type="number"
                                  value={item.costoInstalacion || 0}
                                  onChange={(e) => actualizarItemInstalacion(item.instanceId, 'costoInstalacion', Number(e.target.value))}
                                  style={{ width: '100%', backgroundColor: '#1A1A1A', border: '1px solid #444', color: '#FFF', padding: '6px', borderRadius: '4px', fontSize: '11px' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', color: '#AAA', display: 'block' }}>Fecha (Solo Sábado)</label>
                                <input
                                  type="date"
                                  value={item.fechaCita || ''}
                                  onChange={(e) => {
                                    const f = e.target.value;
                                    if (f && !esSabado(f)) {
                                      alert("Las instalaciones solo se realizan los SÁBADOS.");
                                      actualizarItemInstalacion(item.instanceId, 'fechaCita', '');
                                    } else {
                                      actualizarItemInstalacion(item.instanceId, 'fechaCita', f);
                                    }
                                  }}
                                  style={{ width: '100%', backgroundColor: '#1A1A1A', border: '1px solid #444', color: '#FFF', padding: '6px', borderRadius: '4px', fontSize: '11px' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', color: '#AAA', display: 'block' }}>Hora de Cita</label>
                                <select
                                  value={item.horaCita || ''}
                                  onChange={(e) => actualizarItemInstalacion(item.instanceId, 'horaCita', e.target.value)}
                                  style={{ width: '100%', backgroundColor: '#1A1A1A', border: '1px solid #444', color: '#FFF', padding: '6px', borderRadius: '4px', fontSize: '11px' }}
                                >
                                  <option value="">-- Hora --</option>
                                  <option value="1:00 PM">1:00 PM</option>
                                  <option value="4:00 PM">4:00 PM</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* RESUMEN FINANCIERO */}
                  <div style={{ borderTop: '1px solid #333', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#AAA' }}>
                      <span>Subtotal Productos ({itemsSeleccionados.length} unidades):</span>
                      <span style={{ color: '#FFF', fontWeight: 'bold' }}>RD$ {subtotalProductos.toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#AAA' }}>
                      <span>Total Instalaciones:</span>
                      <span style={{ color: '#FFB800', fontWeight: 'bold' }}>RD$ {totalInstalaciones.toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#AAA' }}>
                      <span>Envío ({zonaSeleccionada.nombre}):</span>
                      <span style={{ color: hayInstalacion ? '#25D366' : '#FFF', fontWeight: 'bold' }}>
                        {hayInstalacion ? '¡GRATIS por Instalación!' : `RD$ ${costoEnvioCalculado.toLocaleString()}`}
                      </span>
                    </div>

                    {vendedorSeleccionado && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#60A5FA', marginTop: '2px' }}>
                        <span>Comisión Est. Vendedor:</span>
                        <span>RD$ {((subtotalProductos * Number(listaVendedores.find(v => v.id === vendedorSeleccionado)?.porcentajeDefecto || 5)) / 100).toLocaleString()}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#25D366', fontSize: '16px', marginTop: '6px' }}>
                      <span>TOTAL A PAGAR:</span>
                      <span>RD$ {totalGeneral.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* CUENTAS BANCARIAS */}
              <div style={{ backgroundColor: '#0D0D0D', padding: '10px', borderRadius: '6px', border: '1px solid #222', fontSize: '11px', color: '#888' }}>
                <strong style={{ color: '#FFB800' }}>Cuentas bancarias que se incluirán en la factura:</strong>
                <p style={{ margin: '3px 0 0 0' }}>Banco Popular: 814423729 | Banreservas: 9605170252 | BHD: 39485910015 | Zelle: Landra2916@gmail.com</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  style={{ backgroundColor: '#222', color: '#AAA', border: '1px solid #444', padding: '10px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoPedido || itemsSeleccionados.length === 0}
                  style={{ backgroundColor: '#25D366', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', opacity: (guardandoPedido || itemsSeleccionados.length === 0) ? 0.5 : 1 }}
                >
                  {guardandoPedido ? 'Guardando...' : 'Confirmar, Descontar Stock & Guardar Cita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VISTA Y MODAL DE FACTURA IMPRIMIBLE / PDF */}
      {facturaParaImprimir && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 2000, padding: '20px', overflowY: 'auto'
        }}>
          <div style={{ width: '100%', maxWidth: '750px', background: '#FFF', color: '#000', borderRadius: '8px', padding: '30px', position: 'relative' }}>
            
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #DDD', paddingBottom: '10px' }}>
              <button
                onClick={() => setFacturaParaImprimir(null)}
                style={{ backgroundColor: '#666', color: '#FFF', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Cerrar
              </button>
              <button
                onClick={() => window.print()}
                style={{ backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                 Imprimir / Guardar en PDF
              </button>
            </div>

            {/* VISTA DE LA FACTURA */}
            <div id="seccion-impresion-factura">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #E50914', paddingBottom: '15px', marginBottom: '20px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '24px', color: '#E50914', textTransform: 'uppercase' }}>GR AUTO ADORNOS</h1>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#555' }}>Accesorios & Instalaciones Electrónicas</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#777' }}>Santo Domingo, República Dominicana | Tel: (809) 555-0199</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', color: '#333' }}>FACTURA</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 'bold', color: '#E50914' }}>Orden #{facturaParaImprimir.orderId}</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#555' }}>Fecha: {new Date(facturaParaImprimir.fecha?.seconds ? facturaParaImprimir.fecha.seconds * 1000 : Date.now()).toLocaleDateString('es-DO')}</p>
                </div>
              </div>

              {/* DATOS DEL CLIENTE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', backgroundColor: '#F9F9F9', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '12px' }}>
                <div>
                  <strong>CLIENTE:</strong> {facturaParaImprimir.clienteNombre || facturaParaImprimir.cliente}<br />
                  <strong>TELÉFONO:</strong> {facturaParaImprimir.telefono}<br />
                  <strong>CORREO:</strong> {facturaParaImprimir.correo || 'N/A'}
                </div>
                <div>
                  <strong>DIRECCIÓN / ZONA:</strong> {facturaParaImprimir.direccion}<br />
                  <strong>MÉTODO DE PAGO:</strong> {facturaParaImprimir.metodoPago}<br />
                  <strong>VENDEDOR:</strong> {facturaParaImprimir.vendedorNombre || 'N/A'}
                </div>
              </div>

              {/* TABLA DE ÍTEMS */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#111', color: '#FFF', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Producto / Ítem</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Cant.</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Precio Unit.</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Instalación</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {facturaParaImprimir.itemsDetalle ? (
                    facturaParaImprimir.itemsDetalle.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #EEE' }}>
                        <td style={{ padding: '8px' }}>
                          <strong>{item.nombre || item.titulo}</strong>
                          {item.requiereInstalacion && (
                            <div style={{ fontSize: '10px', color: '#D97706' }}>
                               Cita Taller: {item.fechaCita} a las {item.horaCita}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>1</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>RD$ {Number(item.precio || item.price || 0).toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{item.requiereInstalacion ? `RD$ ${Number(item.costoInstalacion || 0).toLocaleString()}` : '-'}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                          RD$ {((Number(item.precio || item.price || 0)) + (item.requiereInstalacion ? Number(item.costoInstalacion || 0) : 0)).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ padding: '8px' }}>{facturaParaImprimir.detalles}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* DESGLOSE TOTALES */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <div style={{ width: '250px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal Productos:</span>
                    <span>RD$ {Number(facturaParaImprimir.subtotalProductos || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Instalaciones:</span>
                    <span>RD$ {Number(facturaParaImprimir.totalInstalaciones || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Envío:</span>
                    <span>RD$ {Number(facturaParaImprimir.costoEnvio || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #000', paddingTop: '4px', fontWeight: 'bold', fontSize: '14px' }}>
                    <span>TOTAL:</span>
                    <span>RD$ {Number(facturaParaImprimir.total || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* CUENTAS BANCARIAS */}
              <div style={{ borderTop: '1px solid #DDD', paddingTop: '10px', fontSize: '10px', color: '#555' }}>
                <strong>CUENTAS BANCARIAS PARA TRANSFERENCIA:</strong><br />
                • Banco Popular DOP: Cta. Ahorros N° 814423729<br />
                • Banreservas DOP: Cta. Corriente N° 9605170252<br />
                • BHD DOP: Cta. Corriente N° 39485910015<br />
                • Zelle USD: Landra2916@gmail.com | <strong>Titulares:</strong> Landra Guzman, Freddy Rodriguez
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
