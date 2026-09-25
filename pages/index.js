// pages/index.js
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Link from 'next/link';

export default function Home() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaSel, setCategoriaSel] = useState('Todos');

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
    } font-sans;
    setLoading(false);
  };

  const enviarWhatsApp = (producto) => {
    const mensaje = `Hola GR Auto Adornos, me interesa este producto:%0A%0A*${producto.nombre}*%0APrecio: RD$ ${producto.precio}`;
    window.open(`https://wa.me/18090000000?text=${mensaje}`, '_blank');
  };

  const productosFiltrados = categoriaSel === 'Todos' 
    ? productos 
    : productos.filter(p => p.categoria === categoriaSel);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* Header / Navbar */}
      <header style={{ backgroundColor: '#000000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          {/* Logo del negocio */}
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

          <Link href="/admin/login" style={{ backgroundColor: '#E50914', color: '#FFFFFF', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}>
            Área Admin 🔒
          </Link>
        </div>
      </header>

      {/* Hero Banner */}
      <section style={{ backgroundColor: '#141414', padding: '50px 20px', textAlign: 'center', borderBottom: '1px solid #222' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ backgroundColor: '#3b0000', color: '#ff4d4d', border: '1px solid #E50914', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Taller & Accesorios Automotrices
          </span>
          <h1 style={{ fontSize: '32px', fontWeight: '900', margin: '15px 0 10px', textTransform: 'uppercase' }}>
            Dale el estilo y potencia a tu vehículo
          </h1>
          <p style={{ color: '#AAAAAA', fontSize: '14px', maxWidth: '600px', margin: '0 auto' }}>
            Explora nuestro catálogo de accesorios, iluminación LED, sistemas de audio y servicios para tu auto.
          </p>
        </div>
      </section>

      {/* Catálogo de Productos */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        
        {/* Filtro de Categorías */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '30px' }}>
          {['Todos', 'Accesorios', 'Iluminación', 'Audio', 'Limpieza', 'Taller'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaSel(cat)}
              style={{
                backgroundColor: categoriaSel === cat ? '#E50914' : '#1A1A1A',
                color: '#FFFFFF',
                border: categoriaSel === cat ? '1px solid #E50914' : '1px solid #333',
                padding: '8px 18px',
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
          <div style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>Cargando catálogo...</div>
        ) : productosFiltrados.length === 0 ? (
          <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#888' }}>
            No hay productos registrados aún.
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
                    onClick={() => enviarWhatsApp(prod)}
                    style={{ width: '100%', backgroundColor: '#25D366', color: '#FFF', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Pedir por WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#000000', borderTop: '1px solid #222', padding: '20px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
        <p>© 2026 GR Auto Adornos. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
