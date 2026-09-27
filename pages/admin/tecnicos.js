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

export default function GestionTecnicos() {
  const [tecnicos, setTecnicos] = useState([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [porcentajeDefecto, setPorcentajeDefecto] = useState(20);
  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => {
    cargarTecnicos();
  }, []);

  const cargarTecnicos = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'tecnicos'));
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTecnicos(lista);
    } catch (error) {
      console.error("Error al cargar técnicos:", error);
    }
  };

  const guardarTecnico = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    try {
      if (editandoId) {
        // Actualizar técnico existente
        await updateDoc(doc(db, 'tecnicos', editandoId), {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          porcentajeDefecto: Number(porcentajeDefecto)
        });
        setEditandoId(null);
      } else {
        // Guardar nuevo técnico
        await addDoc(collection(db, 'tecnicos'), {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          porcentajeDefecto: Number(porcentajeDefecto)
        });
      }
      setNombre('');
      setTelefono('');
      setPorcentajeDefecto(20);
      cargarTecnicos();
    } catch (error) {
      console.error("Error al guardar técnico:", error);
    }
  };

  const prepararEdicion = (tec) => {
    setEditandoId(tec.id);
    setNombre(tec.nombre || '');
    setTelefono(tec.telefono || '');
    setPorcentajeDefecto(tec.porcentajeDefecto || 20);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setNombre('');
    setTelefono('');
    setPorcentajeDefecto(20);
  };

  const eliminarTecnico = async (id) => {
    if (confirm('¿Seguro que deseas eliminar este técnico?')) {
      await deleteDoc(doc(db, 'tecnicos', id));
      cargarTecnicos();
    }
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', padding: '20px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* CABECERA DE NAVEGACIÓN */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link href="/admin/comisiones">
            <button style={{ backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              ← Volver Atrás
            </button>
          </Link>
          <h2 style={{ margin: 0, fontSize: '20px' }}>👷‍♂️ Gestión de Técnicos</h2>
        </div>

        <Link href="/admin/dashboard">
          <button style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
            Volver al Panel
          </button>
        </Link>
      </header>

      {/* Formulario para agregar / editar */}
      <form onSubmit={guardarTecnico} style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="Nombre del técnico (ej. Carlos López)"
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
          {editandoId ? 'Guardar Cambios' : '+ Agregar Técnico'}
        </button>
        {editandoId && (
          <button type="button" onClick={cancelarEdicion} style={{ backgroundColor: '#444', color: '#FFF', padding: '10px 15px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Cancelar
          </button>
        )}
      </form>

      {/* Lista de Técnicos */}
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
          {tecnicos.map(tec => (
            <tr key={tec.id} style={{ borderBottom: '1px solid #333' }}>
              <td style={{ padding: '10px' }}>{tec.nombre}</td>
              <td style={{ padding: '10px', color: '#AAA' }}>{tec.telefono || 'Sin registrar'}</td>
              <td style={{ padding: '10px' }}>{tec.porcentajeDefecto || 20}%</td>
              <td style={{ padding: '10px', display: 'flex', gap: '10px' }}>
                <button onClick={() => prepararEdicion(tec)} style={{ backgroundColor: '#0070f3', color: '#FFF', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Editar</button>
                <button onClick={() => eliminarTecnico(tec.id)} style={{ backgroundColor: '#d93025', color: '#FFF', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Eliminar</button>
              </td>
            </tr>
          ))}
          {tecnicos.length === 0 && (
            <tr>
              <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                No hay técnicos registrados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
