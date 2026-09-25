<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GR Auto Adornos | Panel de Control</title>
  
  <!-- FontAwesome Icons & Tailwind CSS -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brandRed: '#E50914',
            brandDark: '#0D0D0D',
            brandCard: '#181818',
            brandGray: '#1a1a1a'
          }
        }
      }
    }
  </script>
</head>
<body class="bg-brandDark text-white font-sans min-h-screen flex flex-col">

  <!-- ========================================== -->
  <!-- 1. PANTALLA DE INICIO DE SESIÓN (LOGIN)    -->
  <!-- ========================================== -->
  <div id="section-login" class="flex-grow flex items-center justify-center p-4">
    <div class="bg-brandCard border border-gray-800 p-8 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
      <div class="text-center mb-8">
        <img src="LOGO NEGRO.jpeg" alt="GR Auto Adornos Logo" class="h-16 w-auto mx-auto mb-3 object-contain rounded" onError="this.style.display='none'">
        <h1 class="text-2xl font-black text-white tracking-wider uppercase">PANEL DE CONTROL</h1>
        <p class="text-xs text-gray-400 mt-1">Acceso administrativo de GR Auto Adornos</p>
      </div>

      <!-- Alerta de Error -->
      <div id="login-error" class="hidden bg-red-950 border border-brandRed text-red-300 p-3 rounded-lg text-xs mb-4 text-center">
        Credenciales incorrectas. Verifica tu correo y contraseña.
      </div>

      <form id="form-login" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-300 uppercase mb-1">Correo Electrónico</label>
          <div class="relative">
            <input type="email" id="login-email" required placeholder="admin@autoadornos.com" class="w-full bg-black border border-gray-700 rounded-lg py-2.5 px-3 pl-9 text-xs text-white focus:outline-none focus:border-brandRed transition">
            <i class="fas fa-envelope absolute left-3 top-3 text-gray-500 text-xs"></i>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-300 uppercase mb-1">Contraseña</label>
          <div class="relative">
            <input type="password" id="login-password" required placeholder="••••••••" class="w-full bg-black border border-gray-700 rounded-lg py-2.5 px-3 pl-9 text-xs text-white focus:outline-none focus:border-brandRed transition">
            <i class="fas fa-lock absolute left-3 top-3 text-gray-500 text-xs"></i>
          </div>
        </div>

        <button type="submit" id="btn-login" class="w-full bg-brandRed hover:bg-red-700 text-white font-bold py-3 rounded-lg transition uppercase tracking-wider text-xs shadow-lg flex justify-center items-center">
          <i class="fas fa-sign-in-alt mr-2"></i> Iniciar Sesión
        </button>
      </form>
    </div>
  </div>

  <!-- ========================================== -->
  <!-- 2. ESTRUCTURA DEL DASHBOARD PRINCIPAL      -->
  <!-- ========================================== -->
  <div id="section-dashboard" class="hidden min-h-screen flex-col">
    
    <!-- Barra de Navegación Superior (TopBar) -->
    <header class="bg-black border-b border-gray-800 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        
        <div class="flex items-center space-x-3">
          <span class="text-lg font-black text-white tracking-wider">GR ADMIN</span>
          <span class="text-[10px] bg-red-950 text-red-400 border border-brandRed px-2 py-0.5 rounded font-bold uppercase">Panel de Control</span>
        </div>

        <div class="flex items-center space-x-4">
          <a href="index.html" target="_blank" class="text-xs bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition flex items-center">
            <i class="fas fa-external-link-alt mr-1.5 text-brandRed"></i> Ver Tienda Web
          </a>
          
          <button id="btn-logout" class="text-xs bg-brandRed hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition flex items-center">
            <i class="fas fa-sign-out-alt mr-1.5"></i> Salir
          </button>
        </div>

      </div>

      <!-- Menú Superior de Navegación del Panel -->
      <nav class="bg-brandCard border-t border-gray-800 px-4">
        <div class="max-w-7xl mx-auto flex space-x-1 overflow-x-auto text-xs py-1">
          <button onclick="cambiarModulo('productos')" id="tab-productos" class="tab-btn active bg-brandRed text-white px-4 py-2.5 rounded-lg font-bold flex items-center whitespace-nowrap">
            <i class="fas fa-box mr-2"></i> Productos & Web
          </button>
          <button onclick="cambiarModulo('pedidos')" id="tab-pedidos" class="tab-btn text-gray-400 hover:text-white px-4 py-2.5 rounded-lg font-bold flex items-center whitespace-nowrap">
            <i class="fas fa-shopping-cart mr-2"></i> Pedidos & Facturas
          </button>
          <button onclick="cambiarModulo('inventario')" id="tab-inventario" class="tab-btn text-gray-400 hover:text-white px-4 py-2.5 rounded-lg font-bold flex items-center whitespace-nowrap">
            <i class="fas fa-warehouse mr-2"></i> Inventario & Alertas
          </button>
          <button onclick="cambiarModulo('metricas')" id="tab-metricas" class="tab-btn text-gray-400 hover:text-white px-4 py-2.5 rounded-lg font-bold flex items-center whitespace-nowrap">
            <i class="fas fa-chart-line mr-2"></i> Métricas & Ganancias
          </button>
          <button onclick="cambiarModulo('crm')" id="tab-crm" class="tab-btn text-gray-400 hover:text-white px-4 py-2.5 rounded-lg font-bold flex items-center whitespace-nowrap">
            <i class="fas fa-users mr-2"></i> Clientes (CRM)
          </button>
          <button onclick="cambiarModulo('citas')" id="tab-citas" class="tab-btn text-gray-400 hover:text-white px-4 py-2.5 rounded-lg font-bold flex items-center whitespace-nowrap">
            <i class="fas fa-calendar-alt mr-2"></i> Citas Taller
          </button>
        </div>
      </nav>
    </header>

    <!-- ÁREA DE CONTENIDO DE LOS MÓDULOS -->
    <main class="max-w-7xl mx-auto px-4 py-6 flex-grow w-full">
      
      <!-- Módulo 1: Productos -->
      <section id="modulo-productos" class="modulo-content">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-black">GESTOR DE PRODUCTOS Y CATÁLOGO</h2>
          <button class="bg-brandRed hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition flex items-center">
            <i class="fas fa-plus mr-2"></i> Nuevo Producto
          </button>
        </div>
        <p class="text-gray-400 text-xs">Aquí podrás agregar, cambiar fotos, editar precios y cambiar categorías de los artículos.</p>
      </section>

      <!-- Módulo 2: Pedidos -->
      <section id="modulo-pedidos" class="modulo-content hidden">
        <h2 class="text-xl font-black mb-6">PEDIDOS REALIZADOS Y FACTURACIÓN</h2>
        <p class="text-gray-400 text-xs">Listado por orden de llegada con opción de enviar factura por WhatsApp.</p>
      </section>

      <!-- Módulo 3: Inventario -->
      <section id="modulo-inventario" class="modulo-content hidden">
        <h2 class="text-xl font-black mb-6">INVENTARIO Y CONTROL DE STOCK</h2>
        <p class="text-gray-400 text-xs">Alertas de stock bajo ($\le 3$) y control de entregas pendientes.</p>
      </section>

      <!-- Módulo 4: Métricas -->
      <section id="modulo-metricas" class="modulo-content hidden">
        <h2 class="text-xl font-black mb-6">MÉTRICAS FINANCIERAS Y GANANCIAS</h2>
        <p class="text-gray-400 text-xs">Cálculo de márgenes de ganancia y comparación mensual de ventas.</p>
      </section>

      <!-- Módulo 5: CRM -->
      <section id="modulo-crm" class="modulo-content hidden">
        <h2 class="text-xl font-black mb-6">CRM Y FIDELIZACIÓN DE CLIENTES</h2>
        <p class="text-gray-400 text-xs">Recordatorio automático para enviar mensajes a clientes tras 15 días de su compra.</p>
      </section>

      <!-- Módulo 6: Citas -->
      <section id="modulo-citas" class="modulo-content hidden">
        <h2 class="text-xl font-black mb-6">AGENDA DE CITAS DE INSTALACIÓN</h2>
        <p class="text-gray-400 text-xs">Coordinación de trabajos en taller de sábados.</p>
      </section>

    </main>
  </div>

  <!-- FIREBASE AUTHENTICATION Y LOGICA DEL DASHBOARD -->
  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
    import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
    import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

    // Configuración exacta de Firebase de tu proyecto
    const firebaseConfig = {
      apiKey: "AIzaSyDDJltPlA8kjDzWnYFNkQnRBxFylSH52Tg",
      authDomain: "gr-auto-adornos.firebaseapp.com",
      projectId: "gr-auto-adornos",
      storageBucket: "gr-auto-adornos.firebasestorage.app",
      messagingSenderId: "387692589652",
      appId: "1:387692589652:web:25cdeb4fcb183e00f133c1",
      measurementId: "G-XD4DMESRJ4"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    const sectionLogin = document.getElementById('section-login');
    const sectionDashboard = document.getElementById('section-dashboard');
    const loginError = document.getElementById('login-error');

    // VERIFICAR ESTADO DE AUTENTICACIÓN
    onAuthStateChanged(auth, (user) => {
      if (user) {
        sectionLogin.classList.add('hidden');
        sectionDashboard.classList.remove('hidden');
        sectionDashboard.classList.add('flex');
      } else {
        sectionLogin.classList.remove('hidden');
        sectionDashboard.classList.add('hidden');
        sectionDashboard.classList.remove('flex');
      }
    });

    // EVENTO DE INICIO DE SESIÓN
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.classList.add('hidden');
      
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        console.error("Error al iniciar sesión:", error.message);
        loginError.classList.remove('hidden');
      }
    });

    // EVENTO DE CERRAR SESIÓN
    document.getElementById('btn-logout').addEventListener('click', () => {
      signOut(auth);
    });

    // NAVEGACIÓN ENTRE MÓDULOS
    window.cambiarModulo = function(nombreModulo) {
      document.querySelectorAll('.modulo-content').forEach(mod => mod.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-brandRed', 'text-white');
        btn.classList.add('text-gray-400');
      });

      document.getElementById(`modulo-${nombreModulo}`).classList.remove('hidden');
      const activeTab = document.getElementById(`tab-${nombreModulo}`);
      activeTab.classList.add('bg-brandRed', 'text-white');
      activeTab.classList.remove('text-gray-400');
    };
  </script>
</body>
</html>