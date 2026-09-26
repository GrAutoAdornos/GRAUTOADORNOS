// pages/admin/inventario.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function InventarioAdmin() {
  const router = useRouter();
  const [productos, setProductos] = useState([]);
  const [ventasPorProducto, setVentasPorProducto] = useState({});
  const [categoria, setCategoria] = useState('Todas');
  const [filtroAlerta, setFiltroAlerta] = useState('TODOS'); // 'TODOS', 'AGOTADOS', 'POCO'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) router.push('/admin/login');
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      // 1. Cargar Productos
      const snapProds = await getDocs(collection(db, 'productos'));
      const listProds = [];
      snapProds.forEach((d) => listProds.push({ id: d.id, ...d.data() }));

      // 2. Cargar Pedidos para calcular Unidades Vendidas Reales
      const snapPedidos = await getDocs(collection(db, 'pedidos'));
      const conteoVentas = {};

      snapPedidos.forEach((doc) => {
        const pedido = doc.data();
        const detalles = pedido.detalles || '';

        listProds.forEach((prod) => {
          if (detalles.includes(prod.nombre)) {
            const regex = new RegExp(`${prod.nombre.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\(x(\\d+)\\)`, 'i');
            const match = detalles.match(regex);
            const cantidad = match ? parseInt(match[1], 10) : 1;

            conteoVentas[prod.id] = (conteoVentas[prod.id] || 0) + cantidad;
          }
        });
      });

      setVentasPorProducto(conteoVentas);
      setProductos(listProds);
    } catch (error) {
      console.error("Error al cargar inventario:", error);
    } finally {
      setLoading(false);
    }
  };

  // Función rápida para sumar o restar stock directamente desde el inventario
  const actualizarStockRapido = async (idProducto, stockActual, cantidadCambio) => {
    const nuevoStock = Math.max(0, stockActual + cantidadCambio);
    try {
      const refProd = doc(db, 'productos', idProducto);
      await updateDoc(refProd, { stock: nuevoStock });

      // Actualizar estado local
      setProductos(prev =>
        prev.map(p => p.id === idProducto ? { ...p, stock: nuevoStock } : p)
      );
    } catch (error) {
      console.error("Error al actualizar stock:", error);
      alert("No se pudo actualizar el stock.");
    }
  };

  // Filtrado por categoría y por estado de alerta
  const prodsFiltrados = productos.filter(p => {
    const stockDisponible = Number(p.stock ?? 0);
    const agotado = stockDisponible <= 0;
    const pocoStock = stockDisponible > 0 && stockDisponible <= 2;

    const cumpleCategoria = categoria === 'Todas' || p.categoria === categoria;
    
    if (filtroAlerta === 'AGOTADOS') return cumpleCategoria && agotado;
    if (filtroAlerta === 'POCO') return cumpleCategoria && pocoStock;
    return cumpleCategoria;
  });

  // Contadores para las alertas
  const totalAgotados = productos.filter(p => Number(p.stock ?? 0) <= 0).length;
  const totalPocoStock = productos.filter(p => {
    const s = Number(p.stock ?? 0);
    return s > 0 && s <= 2;
  }).length;

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>INVENTARIO & ALERTAS</span></span>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>Volver al Panel</Link>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '25px 20px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px' }}>Control de Existencias & Alertas</h3>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#888' }}>Monitorea qué productos están por agotarse para reabastecer a tiempo.</p>
          </div>

          {/* Selector de Categorías */}
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ backgroundColor: '#141414', color: '#FFF', border: '1px solid #333', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
            <option value="Todas">Todas las Categorías</option>
            <option value="Accesorios">Accesorios</option>
            <option value="Iluminación">Iluminación</option>
            <option value="Audio">Audio</option>
            <option value="Pantallas & Cámaras">Pantallas & Cámaras</option>
            <option value="Tintados">Tintados</option>
          </select>
        </div>

        {/* BOTONES DE ALERTA RÁPIDA (Filtros inteligentes) */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFiltroAlerta('TODOS')}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #333',
              backgroundColor: filtroAlerta === 'TODOS' ? '#E50914' : '#141414',
              color: '#FFF',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          >
            📦 Todos ({productos.length})
          </button>

          <button
            onClick={() => setFiltroAlerta('POCO')}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #FFB800',
              backgroundColor: filtroAlerta === 'POCO' ? '#FFB800' : '#141414',
              color: filtroAlerta === 'POCO' ? '#000' : '#FFB800',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          >
            ⚠️ Alerta Poco Stock ({totalPocoStock})
          </button>

          <button
            onClick={() => setFiltroAlerta('AGOTADOS')}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #ff4d4d',
              backgroundColor: filtroAlerta === 'AGOTADOS' ? '#ff4d4d' : '#141414',
              color: filtroAlerta === 'AGOTADOS' ? '#FFF' : '#ff4d4d',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          >
            🚫 Agotados ({totalAgotados})
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>Calculando ventas e inventario...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {prodsFiltrados.length === 0 ? (
              <p style={{ color: '#888', gridColumn: '1 / -1', textAlign: 'center', padding: '30px', backgroundColor: '#141414', borderRadius: '8px', border: '1px solid #222' }}>
                No hay productos en esta selección.
              </p>
            ) : (
              prodsFiltrados.map((p) => {
                const stockDisponible = Number(p.stock ?? 0);
                const vendidosReales = ventasPorProducto[p.id] || 0;
                const stockInicialCalculado = stockDisponible + vendidosReales;
                
                const pocoStock = stockDisponible > 0 && stockDisponible <= 2;
                const agotado = stockDisponible <= 0;

                return (
                  <div 
                    key={p.id} 
                    style={{ 
                      backgroundColor: '#141414', 
                      border: agotado ? '1px solid #ff4d4d' : pocoStock ? '1px solid #FFB800' : '1px solid #222', 
                      borderRadius: '10px', 
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '15px', color: '#FFF' }}>{p.nombre}</h4>
                        
                        {agotado ? (
                          <span style={{ fontSize: '11px', color: '#ff4d4d', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🚫 AGOTADO</span>
                        ) : pocoStock ? (
                          <span style={{ fontSize: '11px', color: '#FFB800', fontWeight: 'bold', whiteSpace: 'nowrap' }}>⚠️ ¡Poco stock!</span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#25D366', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🟢 Stock Normal</span>
                        )}
                      </div>

                      <p style={{ fontSize: '12px', color: '#888', margin: '0 0 12px 0' }}>Categoría: {p.categoria || 'Sin Categoría'}</p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#AAA', borderTop: '1px solid #222', paddingTop: '10px', marginBottom: '15px' }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '10px', color: '#666' }}>INICIAL</span>
                          <strong style={{ color: '#FFF' }}>{stockInicialCalculado} unds.</strong>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '10px', color: '#666' }}>VENDIDOS</span>
                          <strong style={{ color: '#E50914' }}>{vendidosReales} unds.</strong>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '10px', color: '#666' }}>DISPONIBLE</span>
                          <strong style={{ color: '#25D366' }}>{stockDisponible} unds.</strong>
                        </div>
                      </div>
                    </div>

                    {/* BOTONES DE REABASTECIMIENTO RÁPIDO */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0D0D0D', padding: '8px 10px', borderRadius: '6px', border: '1px solid #222' }}>
                      <span style={{ fontSize: '11px', color: '#888' }}>Ajustar Stock:</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => actualizarStockRapido(p.id, stockDisponible, -1)}
                          style={{ backgroundColor: '#222', color: '#ff4d4d', border: '1px solid #444', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                          title="Restar 1 unidad"
                        >
                          -
                        </button>
                        <button
                          onClick={() => actualizarStockRapido(p.id, stockDisponible, 1)}
                          style={{ backgroundColor: '#222', color: '#25D366', border: '1px solid #444', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                          title="Sumar 1 unidad (Reabastecer)"
                        >
                          +
                        </button>
                        <button
                          onClick={() => {
                            const cantidadExtra = prompt(`¿Cuántas unidades nuevas llegaron para "${p.nombre}"?`, "5");
                            if (cantidadExtra && !isNaN(cantidadExtra)) {
                              actualizarStockRapido(p.id, stockDisponible, parseInt(cantidadExtra, 10));
                            }
                          }}
                          style={{ backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                        >
                          + Lote
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
