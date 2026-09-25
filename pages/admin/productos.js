// pages/admin/productos.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function AdminProductos() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState([]);
  
  // Estado para el formulario
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [categoria, setCategoria] = useState('Accesorios');
  const [stock, setStock] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [guardando, setGuardando] = useState(false);

  const router = useRouter();

  // Proteger la ruta
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/admin/login');
      } else {
        setUser(currentUser);
        cargarProductos();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Cargar productos de Firestore
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
    }
  };

  // Guardar un nuevo producto
  const handleGuardarProducto = async (e) => {
    e.preventDefault();
    if (!nombre || !precio || !stock) return;

    setGuardando(true);
    try {
      await addDoc(collection(db, 'productos'), {
        nombre,
        precio: parseFloat(precio),
        categoria,
        stock: parseInt(stock),
        imagenUrl: imagenUrl || 'https://via.placeholder.com/150',
        fechaCreacion: new Date()
      });

      // Limpiar formulario
      setNombre('');
      setPrecio('');
      setStock('');
      setImagenUrl('');
      
      cargarProductos();
    } catch (error) {
      console.error("Error al guardar:", error);
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar producto
  const handleEliminar = async (id) => {
    if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
      try {
        await deleteDoc(doc(db, 'productos', id));
        cargarProductos();
      } catch (error) {
        console.error("Error al eliminar:", error);
      }
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center text-xs">Cargando Módulo...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col font-sans">
      {/* Topbar */}
      <header className="bg-black border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="text-lg font-black tracking-wider">GR ADMIN</span>
            <span className="text-[10px] bg-red-950 text-red-400 border border-[#E50914] px-2 py-0.5 rounded font-bold uppercase">
              Productos
            </span>
          </div>

          <Link href="/admin/dashboard" className="text-xs bg-gray-900 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
            ← Volver al Panel
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 flex-grow w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Formulario de Agregar / Editar */}
        <div className="bg-[#181818] border border-gray-800 p-6 rounded-2xl h-fit">
          <h3 className="text-sm font-black uppercase text-white mb-4 tracking-wider flex items-center">
            <i className="fas fa-plus-circle text-[#E50914] mr-2"></i> Agregar Nuevo Producto
          </h3>

          <form onSubmit={handleGuardarProducto} className="space-y-4 text-xs">
            <div>
              <label className="block text-gray-400 mb-1">Nombre del Producto</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Luces LED H4"
                className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#E50914]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 mb-1">Precio (DOP $)</label>
                <input
                  type="number"
                  required
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  placeholder="1500"
                  className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#E50914]"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Stock Inicial</label>
                <input
                  type="number"
                  required
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="10"
                  className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#E50914]"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 mb-1">Categoría</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#E50914]"
              >
                <option value="Accesorios">Accesorios</option>
                <option value="Iluminación">Iluminación</option>
                <option value="Audio">Audio</option>
                <option value="Limpieza">Limpieza & Cuidado</option>
                <option value="Taller">Servicios de Taller</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 mb-1">URL de Imagen (Link de foto)</label>
              <input
                type="url"
                value={imagenUrl}
                onChange={(e) => setImagenUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#E50914]"
              />
            </div>

            <button
              type="submit"
              disabled={guardando}
              className="w-full bg-[#E50914] hover:bg-red-700 text-white font-bold py-3 rounded-lg uppercase tracking-wider text-xs transition"
            >
              {guardando ? 'Guardando...' : 'Guardar Producto'}
            </button>
          </form>
        </div>

        {/* Lista de Productos */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-black uppercase text-white tracking-wider flex justify-between items-center">
            <span>Inventario de Productos ({productos.length})</span>
          </h3>

          {productos.length === 0 ? (
            <div className="bg-[#181818] border border-gray-800 rounded-2xl p-8 text-center text-xs text-gray-500">
              No hay productos registrados aún. Agrega el primero usando el formulario.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {productos.map((prod) => (
                <div key={prod.id} className="bg-[#181818] border border-gray-800 p-4 rounded-xl flex space-x-4 items-center">
                  <img
                    src={prod.imagenUrl}
                    alt={prod.nombre}
                    className="w-16 h-16 object-cover rounded-lg bg-black border border-gray-800"
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/150'; }}
                  />
                  <div className="flex-grow min-w-0">
                    <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-semibold uppercase">
                      {prod.categoria}
                    </span>
                    <h4 className="text-xs font-bold text-white truncate mt-1">{prod.nombre}</h4>
                    <div className="flex space-x-3 text-xs mt-1">
                      <span className="text-[#E50914] font-bold">RD$ {prod.precio}</span>
                      <span className={`font-semibold ${prod.stock <= 3 ? 'text-red-400' : 'text-gray-400'}`}>
                        Stock: {prod.stock}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEliminar(prod.id)}
                    className="text-gray-500 hover:text-red-500 p-2 transition text-xs"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
