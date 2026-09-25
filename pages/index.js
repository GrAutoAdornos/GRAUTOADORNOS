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
    } finally {
      setLoading(false);
    }
  };

  const enviarWhatsApp = (producto) => {
    const mensaje = `Hola GR Auto Adornos, me interesa este producto:%0A%0A*${producto.nombre}*%0APrecio: RD$ ${producto.precio}`;
    window.open(`https://wa.me/18090000000?text=${mensaje}`, '_blank');
  };

  const productosFiltrados = categoriaSel === 'Todos' 
    ? productos 
    : productos.filter(p => p.categoria === categoriaSel);

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white font-sans flex flex-col">
      
      {/* Header / Navbar */}
      <header className="bg-black/90 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-black tracking-widest text-white">GR <span className="text-[#E50914]">AUTO ADORNOS</span></span>
          </div>

          <Link href="/admin/login" className="text-xs bg-gray-900 border border-gray-700 hover:border-[#E50914] text-gray-300 px-3 py-1.5 rounded-lg transition">
            Área Admin 🔒
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-black to-[#0D0D0D] py-16 px-4 text-center border-b border-gray-800">
        <div className="max-w-3xl mx-auto space-y-4">
          <span className="text-[10px] bg-red-950 text-red-400 border border-[#E50914] px-3 py-1 rounded-full font-bold uppercase tracking-widest">
            Taller & Accesorios Automotrices
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase">
            Dale el estilo y potencia a tu vehículo
          </h1>
          <p className="text-gray-400 text-xs md:text-sm max-w-xl mx-auto">
            Explora nuestro catálogo de accesorios, iluminación LED, sistemas de audio y servicios para tu auto.
          </p>
        </div>
      </section>

      {/* Catálogo de Productos */}
      <main className="max-w-7xl mx-auto px-4 py-12 flex-grow w-full space-y-8">
        
        {/* Filtro de Categorías */}
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          {['Todos', 'Accesorios', 'Iluminación', 'Audio', 'Limpieza', 'Taller'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaSel(cat)}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                categoriaSel === cat 
                  ? 'bg-[#E50914] text-white' 
                  : 'bg-[#181818] text-gray-400 border border-gray-800 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid de Productos */}
        {loading ? (
          <div className="text-center py-12 text-xs text-gray-500">Cargando catálogo...</div>
        ) : productosFiltrados.length === 0 ? (
          <div className="bg-[#181818] border border-gray-800 rounded-2xl p-12 text-center text-xs text-gray-500">
            No hay productos disponibles en esta categoría por el momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {productosFiltrados.map((prod) => (
              <div key={prod.id} className="bg-[#181818] border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition flex flex-col justify-between">
                <div>
                  <img 
                    src={prod.imagenUrl} 
                    alt={prod.nombre} 
                    className="w-full h-48 object-cover bg-black"
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=GR+Auto+Adornos'; }}
                  />
                  <div className="p-4 space-y-2">
                    <span className="text-[10px] bg-gray-900 text-gray-400 px-2 py-0.5 rounded font-semibold uppercase border border-gray-800">
                      {prod.categoria}
                    </span>
                    <h3 className="text-sm font-bold text-white leading-snug">{prod.nombre}</h3>
                    <p className="text-base font-black text-[#E50914]">RD$ {prod.precio}</p>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <button
                    onClick={() => enviarWhatsApp(prod)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center space-x-2"
                  >
                    <span>Pedir por WhatsApp</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-black border-t border-gray-800 py-8 text-center text-xs text-gray-600">
        <p>© 2026 GR Auto Adornos. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
