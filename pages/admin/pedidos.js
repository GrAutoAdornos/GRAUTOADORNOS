// pages/admin/pedidos.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function AdminPedidos() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/admin/login');
      } else {
        setUser(currentUser);
        cargarPedidos();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const cargarPedidos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'pedidos'));
      const docs = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setPedidos(docs);
    } catch (error) {
      console.error("Error al cargar pedidos:", error);
    }
  };

  const handleCambiarEstado = async (id, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'pedidos', id), { estado: nuevoEstado });
      cargarPedidos();
    } catch (error) {
      console.error("Error al actualizar estado:", error);
    }
  };

  const enviarFacturaWhatsApp = (pedido) => {
    const mensaje = `*FACTURA DE COMPRA - GR AUTO ADORNOS*%0A%0A` +
      `*Cliente:* ${pedido.clienteNombre}%0A` +
      `*Teléfono:* ${pedido.clienteTelefono}%0A` +
      `*Producto/Servicio:* ${pedido.detalles}%0A` +
      `*Total:* RD$ ${pedido.total}%0A` +
      `*Estado:* ${pedido.estado}%0A%0A` +
      `¡Gracias por preferir GR Auto Adornos!`;

    const url = `https://wa.me/${pedido.clienteTelefono}?text=${mensaje}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center text-xs">Cargando Módulo...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col font-sans">
      <header className="bg-black border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="text-lg font-black tracking-wider">GR ADMIN</span>
            <span className="text-[10px] bg-red-950 text-red-400 border border-[#E50914] px-2 py-0.5 rounded font-bold uppercase">
              Pedidos y Facturas
            </span>
          </div>

          <Link href="/admin/dashboard" className="text-xs bg-gray-900 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
            ← Volver al Panel
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 flex-grow w-full space-y-6">
        <h3 className="text-sm font-black uppercase text-white tracking-wider">
          Gestión de Pedidos y Recibos ({pedidos.length})
        </h3>

        {pedidos.length === 0 ? (
          <div className="bg-[#181818] border border-gray-800 rounded-2xl p-8 text-center text-xs text-gray-500">
            No hay pedidos registrados en el sistema.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pedidos.map((pedido) => (
              <div key={pedido.id} className="bg-[#181818] border border-gray-800 p-5 rounded-xl space-y-3">
                <div className="flex justify-between items-start border-b border-gray-800 pb-2">
                  <div>
                    <h4 className="text-xs font-bold text-white">{pedido.clienteNombre}</h4>
                    <p className="text-[10px] text-gray-400">{pedido.clienteTelefono}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    pedido.estado === 'Completado' ? 'bg-green-950 text-green-400 border border-green-800' : 'bg-yellow-950 text-yellow-400 border border-yellow-800'
                  }`}>
                    {pedido.estado || 'Pendiente'}
                  </span>
                </div>

                <div className="text-xs text-gray-300 space-y-1">
                  <p><span className="text-gray-500">Detalle:</span> {pedido.detalles}</p>
                  <p className="text-[#E50914] font-black text-sm">RD$ {pedido.total}</p>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={() => handleCambiarEstado(pedido.id, 'Completado')}
                    className="flex-1 bg-green-900 hover:bg-green-800 text-green-200 text-[10px] font-bold py-2 rounded-lg transition"
                  >
                    ✓ Marcar Listo
                  </button>
                  <button
                    onClick={() => enviarFacturaWhatsApp(pedido)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-2 rounded-lg transition flex items-center justify-center space-x-1"
                  >
                    <span>📲 Facturar WA</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
