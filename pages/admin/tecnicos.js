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

export default function GestionTecnicos() {
  const [tecnicos, setTecnicos] = useState([]);
  const [nombre, setNombre] = useState('');
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
          porcentajeDefecto: Number(porcentajeDefecto)
        });
        setEditandoId(null);
      } else {
        // Guardar nuevo técnico
        await addDoc(collection(db, 'tecnicos'), {
          nombre: nombre.trim(),
          porcentajeDefecto: Number(porcentajeDefecto)
        });
      }
      setNombre('');
      setPorcentajeDefecto(20);
      cargarTecnicos();
    } catch (error) {
      console.error("Error al guardar técnico:", error);
    }
  };

  const prepararEdicion = (tec) => {
    setEditandoId(tec.id);
    setNombre(tec.nombre);
    setPorcentajeDefecto(tec.porcentajeDefecto || 20);
  };

  const eliminarTecnico = async (id) => {
    if (confirm('¿Seguro que deseas eliminar este técnico?')) {
      await deleteDoc(doc(db, 'tecnicos', id));
      cargarTecnicos();
    }
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', padding: '20px', minHeight: '100vh' }}>
      <h2>👷‍♂️ Gestión de Técnicos</h2>

      {/* Formulario para agregar / editar */}
      <form onSubmit={guardarTecnico} style={{ backgroundColor: '#1A1A1A', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input 
          type="text" 
          placeholder="Nombre del técnico (ej. Carlos López)"
          value={nombre} 
          onChange={(e) => setNombre(e.target.value)}
          style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: '#222', color: '#FFF', border: '1px solid #444' }}
          required
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
          <button type="button" onClick={() => { setEditandoId(null); setNombre(''); }} style={{ backgroundColor: '#444', color: '#FFF', padding: '10px 15px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Cancelar
          </button>
        )}
      </form>

      {/* Lista de Técnicos */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#222', textAlign: 'left' }}>
            <th style={{ padding: '10px' }}>Nombre</th>
            <th style={{ padding: '10px' }}>% Comisión Defecto</th>
            <th style={{ padding: '10px' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tecnicos.map(tec => (
            <tr key={tec.id} style={{ borderBottom: '1px solid #333' }}>
              <td style={{ padding: '10px' }}>{tec.nombre}</td>
              <td style={{ padding: '10px' }}>{tec.porcentajeDefecto}%</td>
              <td style={{ padding: '10px', display: 'flex', gap: '10px' }}>
                <button onClick={() => prepararEdicion(tec)} style={{ backgroundColor: '#0070f3', color: '#FFF', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Editar</button>
                <button onClick={() => eliminarTecnico(tec.id)} style={{ backgroundColor: '#d93025', color: '#FFF', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
