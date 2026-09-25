// pages/admin/login.js
import { useState } from 'react';
import { useRouter } from 'next/router';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase'; // Importamos directamente auth

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    setMensaje({ texto: 'Iniciando sesión...', tipo: 'info' });

    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (typeof window !== 'undefined') {
        localStorage.setItem('adminAuth', 'true');
      }
      router.push('/admin/dashboard');
    } catch (error) {
      setMensaje({ texto: 'Acceso denegado. Correo o contraseña incorrectos.', tipo: 'error' });
    }
  };

  const handleRecuperarPassword = async () => {
    if (!email) {
      setMensaje({ texto: 'Ingresa tu correo electrónico en el campo superior para enviarte el enlace.', tipo: 'error' });
      return;
    }
    
    setMensaje({ texto: 'Enviando enlace...', tipo: 'info' });
    
    try {
      await sendPasswordResetEmail(auth, email);
      setMensaje({ texto: '¡Enlace enviado! Revisa tu bandeja de entrada o spam.', tipo: 'exito' });
    } catch (error) {
      setMensaje({ texto: 'Error al enviar el correo. Verifica que esté bien escrito.', tipo: 'error' });
    }
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '20px' }}>
      <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '12px', padding: '30px', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 5px' }}>GR <span style={{ color: '#E50914' }}>AUTO ADORNOS</span></h1>
        <p style={{ fontSize: '12px', color: '#AAA', marginBottom: '20px' }}>Acceso al Panel Admin</p>

        {mensaje.texto && (
          <div style={{ 
            padding: '10px', 
            marginBottom: '15px', 
            borderRadius: '6px', 
            fontSize: '12px',
            backgroundColor: mensaje.tipo === 'error' ? '#3a0000' : mensaje.tipo === 'exito' ? '#003a00' : '#222',
            color: mensaje.tipo === 'error' ? '#ff4d4d' : mensaje.tipo === 'exito' ? '#25D366' : '#FFF',
            border: `1px solid ${mensaje.tipo === 'error' ? '#E50914' : mensaje.tipo === 'exito' ? '#25D366' : '#555'}`
          }}>
            {mensaje.texto}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email"
            placeholder="Correo electrónico admin"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '12px', borderRadius: '8px', fontSize: '13px', outline: 'none', textAlign: 'center' }}
            required
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '12px', borderRadius: '8px', fontSize: '13px', outline: 'none', textAlign: 'center' }}
          />

          <button type="submit" style={{ backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginTop: '5px' }}>
            Ingresar
          </button>
        </form>

        <button 
          onClick={handleRecuperarPassword} 
          type="button" 
          style={{ background: 'none', border: 'none', color: '#AAA', fontSize: '12px', marginTop: '20px', cursor: 'pointer', textDecoration: 'underline' }}
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>
    </div>
  );
}
