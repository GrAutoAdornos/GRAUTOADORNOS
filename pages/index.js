import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-black mb-4">GR AUTO ADORNOS</h1>
      <p className="text-gray-400 text-xs mb-6">Sitio web en construcción.</p>
      <Link 
        href="/admin/login" 
        className="bg-[#E50914] text-white text-xs font-bold py-2 px-6 rounded-lg uppercase tracking-wider"
      >
        Ir al Panel de Administración
      </Link>
    </div>
  );
}
