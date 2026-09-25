// pages/admin/proveedores.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function Proveedores() {
  const router = useRouter();
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);

  // Formulario Proveedor
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [contacto, setContacto] = useState('');
  const [direccion, setDireccion] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuth = localStorage.getItem('adminAuth');
      if (!isAuth) {
        router.push('/admin/login');
        return;
      }
      cargarDatos();
    }
  }, []);

  const cargarDatos = async () => {
    try {
      // Cargar Proveedores
      const provSnap = await getDocs(collection(db, 'proveedores'));
      const provList = [];
      provSnap.forEach((d) => provList.push({ id: d.id, ...d.data() }));
      setProveedores(provList);

      // Cargar Productos para vincular historial por proveedor
      const prodSnap = await getDocs(collection(db, 'productos'));
      const prodList = [];
      prodSnap.forEach((d) => prodList.push({ id: d.id, ...d.data() }));
      setProductos(prodList);
    } catch (e) {
      console.error("Error al cargar datos:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarProveedor = async (e) => {
    e.preventDefault();
    if (!nombre) {
      alert("Por favor ingresa el nombre del proveedor");
      return;
    }

    try {
      await addDoc(collection(db, 'proveedores'), {
        nombre,
        telefono,
        contacto,
        direccion,
        creadoEn: new Date().toISOString()
      });

      alert("¡Proveedor agregado exitosamente!");
      setNombre('');
      setTelefono('');
      setContacto('');
      setDireccion('');
      cargarDatos();
    } catch (e) {
      console.error("Error al guardar proveedor:", e);
    }
  };

  const eliminarProveedor = async (id) => {
    if (confirm("¿Deseas eliminar este proveedor?")) {
      await deleteDoc(doc(db, 'proveedores', id));
      if (proveedorSeleccionado?.id === id) setProveedorSeleccionado(null);
      cargarDatos();
    }
  };

  // Filtrar productos asociados al proveedor seleccionado
  const productosDelProveedor = productos.filter(
    (p) => p.proveedor && proveedorSeleccionado && p.proveedor.toLowerCase() === proveedorSeleccionado.nombre.toLowerCase()
  );

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* Navegación Admin */}
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>ADMIN PANEL</span></span>
          
          <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>🛒 Catálogo</Link>
            <Link href="/admin/pedidos" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>📦 Pedidos / Facturas</Link>
            <Link href="/admin/inventario" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>📊 Inventario / Alertas</Link>
            <Link href="/admin/metricas" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>📈 Métricas / Ganancias</Link>
            <Link href="/admin/clientes" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>👥 Clientes / CRM</Link>
            <Link href="/admin/citas" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>📅 Citas</Link>
            <Link href="/admin/proveedores" style={{ backgroundColor: '#E50914', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold' }}>🏢 Proveedores</Link>
          </nav>

          <button onClick={() => { localStorage.removeItem('adminAuth'); router.push('/admin/login'); }} style={{ backgroundColor: '#222', color: '#ff4d4d', border: '1px solid #333', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Salir 🚪</button>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '25px 20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Gestión de Proveedores e Historial de Suministros</h1>

        {/* Formulario Nuevo Proveedor */}
        <form onSubmit={handleGuardarProveedor} style={{ backgroundColor: '#141414', border: '1px solid #222', padding: '20px', borderRadius: '10px', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '14px', color: '#E50914', marginTop: 0, marginBottom: '15px' }}>+ Registrar Nuevo Proveedor</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '15px' }}>
            <input type="text" placeholder="Empresa / Proveedor" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '12px' }} required />
            <input type="text" placeholder="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} style={{ backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '12px' }} />
            <input type="text" placeholder="Persona de Contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} style={{ backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '12px' }} />
            <input type="text" placeholder="Ubicación / Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} style={{ backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '12px' }} />
          </div>
          <button type="submit" style={{ backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Guardar Proveedor</button>
        </form>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
          {/* Lista de Proveedores */}
          <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '15px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '15px' }}>Directorio de Proveedores</h3>
            {proveedores.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#666' }}>No hay proveedores agregados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {proveedores.map((p) => {
                  const estaSeleccionado = proveedorSeleccionado?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setProveedorSeleccionado(p)}
                      style={{
                        backgroundColor: estaSeleccionado ? '#222' : '#0D0D0D',
                        border: estaSeleccionado ? '1px solid #E50914' : '1px solid #222',
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyLink: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#FFF' }}>{p.nombre}</h4>
                        <p style={{ margin: '0', fontSize: '11px', color: '#AAA' }}>📞 {p.telefono || 'Sin teléfono'} | 👤 {p.contacto || 'N/A'}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); eliminarProveedor(p.id); }} style={{ backgroundColor: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historial de Compras y Suministros por Proveedor */}
          <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '15px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '15px' }}>Historial y Productos de Suministro</h3>
            
            {!proveedorSeleccionado ? (
              <p style={{ fontSize: '12px', color: '#888' }}>👈 Selecciona un proveedor de la lista para ver su historial de productos, precios y tiempos de entrega.</p>
            ) : (
              <div>
                <div style={{ backgroundColor: '#000', border: '1px solid #333', padding: '12px', borderRadius: '8px', marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 5px 0', color: '#E50914', fontSize: '15px' }}>{proveedorSeleccionado.nombre}</h4>
                  <p style={{ margin: '0 0 3px 0', fontSize: '12px', color: '#AAA' }}>Contacto: {proveedorSeleccionado.contacto || 'N/A'}</p>
                  <p style={{ margin: '0 0 3px 0', fontSize: '12px', color: '#AAA' }}>Teléfono: {proveedorSeleccionado.telefono || 'N/A'}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#AAA' }}>Dirección: {proveedorSeleccionado.direccion || 'N/A'}</p>
                </div>

                {productosDelProveedor.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#666' }}>No hay productos asociados a este proveedor en el catálogo.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
                        <th style={{ padding: '8px' }}>Producto</th>
                        <th style={{ padding: '8px' }}>Costo Compra</th>
                        <th style={{ padding: '8px' }}>Precio Venta</th>
                        <th style={{ padding: '8px' }}>Tiempo Entrega</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosDelProveedor.map((prod) => (
                        <tr key={prod.id} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{prod.nombre}</td>
                          <td style={{ padding: '8px', color: '#ff4d4d' }}>RD$ {prod.costoCompra || 0}</td>
                          <td style={{ padding: '8px', color: '#25D366' }}>RD$ {prod.precio || 0}</td>
                          <td style={{ padding: '8px', color: '#AAA' }}>⏱️ {prod.tiempoEntrega || 'No especificado'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
