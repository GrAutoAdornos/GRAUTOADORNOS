// pages/admin/dashboard.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function Dashboard() {
  const router = useRouter();
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);

  const [nuevo, setNuevo] = useState({
    nombre: '',
    precio: '',
    costo: '',
    stock: 10,
    categoria: 'Accesorios',
    proveedor: '',
    tiempoEntrega: '',
    imagenUrl: '',
    requiereInstalacion: false,
    costoInstalacion: 0
  });

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
      // 1. Cargar productos
      const snapProd = await getDocs(collection(db, 'productos'));
      const listProd = [];
      snapProd.forEach((d) => listProd.push({ id: d.id, ...d.data() }));
      setProductos(listProd);

      // 2. Cargar proveedores registrados
      const snapProv = await getDocs(collection(db, 'proveedores'));
      const listProv = [];
      snapProv.forEach((d) => listProv.push({ id: d.id, ...d.data() }));
      setProveedores(listProv);
      if (listProv.length > 0 && !nuevo.proveedor) {
        setNuevo((prev) => ({ ...prev, proveedor: listProv[0].nombre }));
      }
    } catch (e) {
      console.error("Error al cargar datos:", e);
    } finally {
      setLoading(false);
    }
  };

  // Subir imagen desde el dispositivo y convertir a DataURL
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("La imagen es muy pesada. Elige una foto de menos de 2MB.");
      return;
    }

    setSubiendoImagen(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setNuevo({ ...nuevo, imagenUrl: reader.result });
      setSubiendoImagen(false);
    };
    reader.readAsDataURL(file);
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    if (!nuevo.nombre || !nuevo.precio) return alert("Completa los campos requeridos");

    try {
      const productoData = {
        ...nuevo,
        precio: Number(nuevo.precio),
        costo: Number(nuevo.costo || 0),
        costoCompra: Number(nuevo.costo || 0),
        stock: Number(nuevo.stock),
        proveedor: nuevo.proveedor || 'Sin Proveedor',
        tiempoEntrega: nuevo.tiempoEntrega || 'Inmediato',
        costoInstalacion: nuevo.requiereInstalacion ? Number(nuevo.costoInstalacion || 0) : 0
      };

      if (editando) {
        await updateDoc(doc(db, 'productos', editando), productoData);
        alert("Producto actualizado con éxito");
      } else {
        await addDoc(collection(db, 'productos'), productoData);
        alert("Producto agregado a la tienda");
      }

      setNuevo({
        nombre: '',
        precio: '',
        costo: '',
        stock: 10,
        categoria: 'Accesorios',
        proveedor: proveedores.length > 0 ? proveedores[0].nombre : '',
        tiempoEntrega: '',
        imagenUrl: '',
        requiereInstalacion: false,
        costoInstalacion: 0
      });
      setEditando(null);
      cargarDatos();
    } catch (e) {
      console.error("Error al guardar:", e);
      alert("Error al guardar en la base de datos");
    }
  };

  const prepararEdicion = (prod) => {
    setEditando(prod.id);
    setNuevo({
      ...prod,
      costo: prod.costo || prod.costoCompra || '',
      proveedor: prod.proveedor || (proveedores.length > 0 ? proveedores[0].nombre : ''),
      tiempoEntrega: prod.tiempoEntrega || ''
    });
  };

  const eliminarProducto = async (id) => {
    if (confirm("¿Seguro que deseas eliminar este producto de la tienda?")) {
      await deleteDoc(doc(db, 'productos', id));
      setProductos(productos.filter((p) => p.id !== id));
    }
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* Navegación Admin Completa */}
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>ADMIN PANEL</span></span>
          
          <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/admin/dashboard" style={{ backgroundColor: '#E50914', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold' }}>🛒 Catálogo</Link>
            <Link href="/admin/pedidos" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>📦 Pedidos / Facturas</Link>
            <Link href="/admin/analiticas" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>📊 Analiticas</Link>
            <Link href="/admin/inventario" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>🚗 Inventario</Link>
            <Link href="/admin/metricas" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>📈 Métricas</Link>
            <Link href="/admin/clientes" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>👥 CRM</Link>
            <Link href="/admin/citas" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>📅 Citas</Link>
            <Link href="/admin/proveedores" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>🏢 Proveedores</Link>
          </nav>

          <button onClick={() => { localStorage.removeItem('adminAuth'); router.push('/admin/login'); }} style={{ backgroundColor: '#222', color: '#ff4d4d', border: '1px solid #333', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Salir 🚪</button>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '25px 20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Gestión Directa del Catálogo Público</h1>

        {/* Formulario de producto */}
        <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '12px', padding: '20px', marginBottom: '30px' }}>
          <h3 style={{ fontSize: '15px', color: '#E50914', marginTop: 0 }}>{editando ? '📝 Editar Producto' : '➕ Agregar Producto a la Web'}</h3>
          
          <form onSubmit={guardarProducto} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <input type="text" placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} style={{ backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '12px' }} required />
            <input type="number" placeholder="Precio Venta (RD$)" value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })} style={{ backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '12px' }} required />
            <input type="number" placeholder="Costo Compra (RD$)" value={nuevo.costo} onChange={(e) => setNuevo({ ...nuevo, costo: e.target.value })} style={{ backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '12px' }} />
            <input type="number" placeholder="Stock Inicial" value={nuevo.stock} onChange={(e) => setNuevo({ ...nuevo, stock: e.target.value })} style={{ backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '12px' }} required />
            
            <select value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })} style={{ backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
              <option value="Accesorios">Accesorios</option>
              <option value="Iluminación">Iluminación</option>
              <option value="Audio">Audio</option>
              <option value="Pantallas & Cámaras">Pantallas & Cámaras</option>
              <option value="Tintados">Tintados</option>
            </select>

            {/* SELECCIÓN DE PROVEEDOR */}
            <select value={nuevo.proveedor} onChange={(e) => setNuevo({ ...nuevo, proveedor: e.target.value })} style={{ backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
              <option value="">-- Seleccionar Proveedor --</option>
              {proveedores.map((prov) => (
                <option key={prov.id} value={prov.nombre}>{prov.nombre}</option>
              ))}
            </select>

            {/* TIEMPO DE ENTREGA DEL PROVEEDOR */}
            <input type="text" placeholder="Tiempo Entrega (ej. 2 días)" value={nuevo.tiempoEntrega} onChange={(e) => setNuevo({ ...nuevo, tiempoEntrega: e.target.value })} style={{ backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '12px' }} />

            {/* Subida de Foto */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '11px', color: '#AAA' }}>Foto del Producto:</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '6px', borderRadius: '6px', fontSize: '11px' }} />
              {subiendoImagen && <span style={{ fontSize: '10px', color: '#E50914' }}>Cargando foto...</span>}
            </div>

            {/* Configuración de Instalación */}
            <div style={{ gridColumn: '1 / -1', backgroundColor: '#181818', padding: '12px', borderRadius: '8px', border: '1px solid #2a2a2a', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                <input 
                  type="checkbox" 
                  checked={nuevo.requiereInstalacion} 
                  onChange={(e) => setNuevo({ ...nuevo, requiereInstalacion: e.target.checked })} 
                  style={{ accentColor: '#E50914', width: '16px', height: '16px' }}
                />
                ¿Ofrece servicio de Instalación?
              </label>

              {nuevo.requiereInstalacion && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#AAA' }}>Costo adicional instalación: RD$</span>
                  <input 
                    type="number" 
                    placeholder="Ej. 500" 
                    value={nuevo.costoInstalacion} 
                    onChange={(e) => setNuevo({ ...nuevo, costoInstalacion: e.target.value })} 
                    style={{ backgroundColor: '#0D0D0D', border: '1px solid #444', color: '#FFF', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', width: '110px' }}
                  />
                </div>
              )}
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="submit" style={{ backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                {editando ? 'Actualizar Producto' : 'Publicar en la Web'}
              </button>
              {editando && (
                <button type="button" onClick={() => { setEditando(null); setNuevo({ nombre: '', precio: '', costo: '', stock: 10, categoria: 'Accesorios', proveedor: '', tiempoEntrega: '', imagenUrl: '', requiereInstalacion: false, costoInstalacion: 0 }); }} style={{ backgroundColor: '#333', color: '#FFF', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Listado de Productos */}
        {loading ? <p style={{ color: '#888' }}>Cargando catálogo...</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '15px' }}>
            {productos.map((p) => (
              <div key={p.id} style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <img src={p.imagenUrl || 'https://via.placeholder.com/150'} alt={p.nombre} style={{ width: '100%', height: '130px', objectFit: 'cover', borderRadius: '6px' }} />
                  <h4 style={{ fontSize: '14px', margin: '10px 0 4px', color: '#FFF' }}>{p.nombre}</h4>
                  <p style={{ fontSize: '11px', color: '#AAA', margin: '0 0 5px' }}>Categoría: <span style={{ color: '#E50914' }}>{p.categoria}</span></p>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#25D366', margin: 0 }}>Precio: RD$ {p.precio}</p>
                  {(p.costo || p.costoCompra) && <p style={{ fontSize: '11px', color: '#888', margin: '3px 0 0' }}>Costo Compra: RD$ {p.costo || p.costoCompra}</p>}
                  
                  <p style={{ fontSize: '11px', color: '#AAA', margin: '4px 0 0' }}>Proveedor: <span style={{ color: '#FFF' }}>{p.proveedor || 'Sin especificar'}</span></p>
                  <p style={{ fontSize: '11px', color: '#AAA', margin: '2px 0 0' }}>Entrega: <span style={{ color: '#FFF' }}>{p.tiempoEntrega || 'No especificado'}</span></p>

                  {p.requiereInstalacion ? (
                    <p style={{ fontSize: '11px', color: '#FFB800', margin: '4px 0 0', fontWeight: 'bold' }}>
                      🔧 Instalación: +RD$ {p.costoInstalacion}
                    </p>
                  ) : (
                    <p style={{ fontSize: '11px', color: '#666', margin: '4px 0 0' }}>🚫 Sin opción de instalación</p>
                  )}

                  <p style={{ fontSize: '11px', color: '#888', margin: '3px 0' }}>Stock: {p.stock} ud.</p>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button onClick={() => prepararEdicion(p)} style={{ flex: 1, backgroundColor: '#222', color: '#FFF', border: '1px solid #333', padding: '6px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>✏️ Editar</button>
                  <button onClick={() => eliminarProducto(p.id)} style={{ backgroundColor: '#1F1F1F', color: '#ff4d4d', border: '1px solid #333', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
