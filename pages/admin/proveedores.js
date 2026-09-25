// pages/admin/proveedores.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function ProveedoresAdmin() {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem('adminAuth')) router.push('/admin/login');
  }, []);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#000', borderBottom: '2px solid #E50914', padding: '15px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900' }}>GR <span style={{ color: '#E50914' }}>PROVEEDORES Y SUPLIDORES</span></span>
          <Link href="/admin/dashboard" style={{ backgroundColor: '#141414', border: '1px solid #333', color: '#FFF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>Volver al Catálogo</Link>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '25px 20px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Módulo de Reposición y Suplidores</h2>
        <div style={{ backgroundColor: '#141414', border: '1px solid #222', padding: '20px', borderRadius: '8px', color: '#888' }}>
          Registra tus distribuidores autorizados para solicitar reabastecimiento directo en cuanto el módulo de inventario te marque la alerta de producto agotado.
        </div>
      </main>
    </div>
  );
}
