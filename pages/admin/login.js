// pages/admin/login.js
import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'grauto2026') {
      if (typeof window !== 'undefined') {
        localStorage.setItem('adminAuth', 'true');
      }
      router.push('/admin/dashboard');
    } else {
      alert("Contraseña incorrecta");
    }
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '20px' }}>
      <div style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '12px', padding: '30px', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 5px' }}>GR <span style={{ color: '#E50914' }}>AUTO ADORNOS</span></h1>
        <p style={{ fontSize: '12px', color: '#AAA', marginBottom: '20px' }}>Acceso al Panel Admin</p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="password"
            placeholder="Contraseña de acceso"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', backgroundColor: '#181818', border: '1px solid #333', color: '#FFF', padding: '12px', borderRadius: '8px', fontSize: '13px', outline: 'none', textAlign: 'center' }}
            required
          />

          <button type="submit" style={{ backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}
