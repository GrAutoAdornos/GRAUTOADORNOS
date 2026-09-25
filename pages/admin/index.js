// pages/admin/index.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center text-xs">
      Redirigiendo al inicio de sesión...
    </div>
  );
}
