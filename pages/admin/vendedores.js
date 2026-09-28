import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import Link from 'next/link';

export default function GestionVendedores() {
  const [vendedores, setVendedores] = useState([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [porcentajeDefecto, setPorcentajeDefecto] = useState(5);
  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => {
    cargarVendedores();
  }, []);

  const cargarVendedores = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'vendedores'));
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVendedores(lista);
    } catch (error) {
      console.error("Error al cargar vendedores:", error);
    }
  };

  const guardarVendedor = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    try {
      if (editandoId) {
        await updateDoc(doc(db, 'vendedores', editandoId), {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          porcentajeDefecto: Number(porcentajeDefecto)
        });
        setEditandoId(null);
      } else {
        await addDoc(collection(db, 'vendedores'), {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          porcentajeDefecto: Number(porcentajeDefecto)
        });
      }
      setNombre('');
      setTelefono('');
      setPorcentajeDefecto(5);
      cargarVendedores();
    } catch (error) {
      console.error("Error al guardar vendedor:", error);
    }
  };

  const prepararEdicion = (vendedor) => {
    setEditandoId(vendedor.id);
    setNombre(vendedor.nombre || '');
    setTelefono(vendedor.telefono || '');
    setPorcentajeDefecto(vendedor.porcentajeDefecto || 5);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setNombre('');
    setTelefono('');
    setPorcentajeDefecto(5);
  };

  const eliminarVendedor = async (id) => {
    if (confirm('¿Seguro que deseas eliminar este vendedor?')) {
      await deleteDoc(doc(db, 'vendedores', id));
      cargarVendedores();
    }
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', padding: '20px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* CABECERA */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link href="/admin/comisiones-vendedores">
            <button style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              ← Volver a Comisiones
            </button>
          </Link>
          <h2 style={{ margin: 0, fontSize: '20px' }}>💼 Gestión de Vendedores</h2>
        </div>

        <Link href="/admin/dashboard">
          <button style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
            Volver al Panel
          </button>
        </Link>
      </header>

      {/* Formulario para agregar / editar */}
      <form onSubmit={guardarVendedor} style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="Nombre del vendedor (ej. Maria Perez)"
          value={nombre} 
          onChange={(e) => setNombre(e.target.value)}
          style={{ flex: 2, minWidth: '200px', padding: '10px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
          required
        />
        <input 
          type="tel" 
          placeholder="Teléfono (ej. 809-555-0199)"
          value={telefono} 
          onChange={(e) => setTelefono(e.target.value)}
          style={{ flex: 1, minWidth: '160px', padding: '10px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
        />
        <input 
          type="number" 
          placeholder="% Comisión por defecto"
          value={porcentajeDefecto} 
          onChange={(e) => setPorcentajeDefecto(e.target.value)}
          style={{ width: '150px', padding: '10px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
        />
        <button type="submit" style={{ backgroundColor: '#E50914', color: '#FFF', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          {editandoId ? 'Guardar Cambios' : '+ Agregar Vendedor'}
        </button>
        {editandoId && (
          <button type="button" onClick={cancelarEdicion} style={{ backgroundColor: '#444', color: '#FFF', padding: '10px 15px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Cancelar
          </button>
        )}
      </form>

      {/* Tabla de Vendedores */}
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ backgroundColor: '#222', color: '#FFF' }}>
            <th style={{ padding: '10px' }}>Nombre</th>
            <th style={{ padding: '10px' }}>Teléfono</th>
            <th style={{ padding: '10px' }}>% Comisión Defecto</th>
            <th style={{ padding: '10px' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {vendedores.map(v => (
            <tr key={v.id} style={{ borderBottom: '1px solid #333' }}>
              <td style={{ padding: '10px' }}>{v.nombre}</td>
              <td style={{ padding: '10px', color: '#AAA' }}>{v.telefono || 'Sin registrar'}</td>
              <td style={{ padding: '10px' }}>{v.porcentajeDefecto || 5}%</td>
              <td style={{ padding: '10px', display: 'flex', gap: '10px' }}>
                <button onClick={() => prepararEdicion(v)} style={{ backgroundColor: '#0070f3', color: '#FFF', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Editar</button>
                <button onClick={() => eliminarVendedor(v.id)} style={{ backgroundColor: '#d93025', color: '#FFF', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Eliminar</button>
              </td>
            </tr>
          ))}
          {vendedores.length === 0 && (
            <tr>
              <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                No hay vendedores registrados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
