// pages/admin/productos.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function ProductosAdmin() {
  const router = useRouter();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState({ nombre: '', precio: '', categoria: 'Accesorios', imagenUrl: '' });

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) {
      router.push('/admin/login');
      return;
    }
    cargarProductos();
  }, []);

  const cargarProductos = async () => {
    try {
      const snap = await getDocs(collection(db, 'productos'));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setProductos(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!nuevo.nombre || !nuevo.precio) return alert("Completa los campos obligatorios");

    try {
      const docRef = await addDoc(collection(db, 'productos'), {
        ...nuevo,
        precio: Number(nuevo.precio)
      });
      setProductos([...productos, { id: docRef.id, ...nuevo, precio: Number(nuevo.precio) }]);
      setNuevo({ nombre: '', precio: '', categoria: 'Accesorios', imagenUrl: '' });
      alert("Producto agregado");
    } catch (e) {
      alert("Error agregando producto");
    }
  };

  const borrarProducto = async (id) => {
    if (confirm("¿Eliminar este producto?")) {
      await deleteDoc(doc(db, 'productos', id));
      setProductos(productos.filter((p) => p.id !== id));
    }
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      <header style={{ backgroundColor: '#000000', borderBottom: '2px solid #E50914', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>PANEL ADMIN</span></span>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' }}>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>
            📊 General
          </Link>
          <Link href="/admin/pedidos" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>
            📦 Pedidos
          </Link>
          <Link href="/admin/productos" style={{ backgroundColor: '#E50914', color: '#FFF', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>
            🏷️ Productos ({productos.length})
          </Link>
        </div>

        {/* Formulario Agregar Producto */}
        <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '12px', padding: '20px', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', color: '#E50914' }}>+ Agregar Nuevo Producto</h2>
          <form onSubmit={handleCrear} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <input required type="text" placeholder="Nombre del Producto" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} style={{ backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }} />
            <input required type="number" placeholder="Precio (RD$)" value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })} style={{ backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }} />
            <select value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })} style={{ backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
              {['Accesorios', 'Iluminación', 'Audio', 'Pantallas & Cámaras', 'Tintados'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="text" placeholder="URL de la Imagen" value={nuevo.imagenUrl} onChange={(e) => setNuevo({ ...nuevo, imagenUrl: e.target.value })} style={{ backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px' }} />
            
            <button type="submit" style={{ backgroundColor: '#25D366', color: '#FFF', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', gridColumn: '1 / -1' }}>Guardar Producto</button>
          </form>
        </div>

        {/* Listado */}
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>Catálogo Actual</h1>
        {loading ? (
          <p style={{ color: '#888' }}>Cargando catálogo...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
            {productos.map((p) => (
              <div key={p.id} style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <img src={p.imagenUrl} alt={p.nombre} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', backgroundColor: '#000' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=GR+Auto'; }} />
                  <h4 style={{ fontSize: '13px', margin: '10px 0 4px', color: '#FFF' }}>{p.nombre}</h4>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#E50914', margin: 0 }}>RD$ {p.precio}</p>
                </div>
                <button onClick={() => borrarProducto(p.id)} style={{ backgroundColor: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', fontSize: '12px', marginTop: '10px', textAlign: 'right' }}>🗑 Eliminar</button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
