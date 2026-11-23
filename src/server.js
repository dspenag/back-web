require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const {
  sincronizarCaducidad,
} = require('./services/publicaciones.service');
const { sembrarUsuarioInicial } = require('./services/auth.service');

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
  try {
    // 1. Conexión a la base de datos
    await connectDB();

    // 2. Semillas iniciales para usuarios y solicitudes
    await sembrarUsuarioInicial();
    await sincronizarCaducidad();

    setInterval(() => {
      sincronizarCaducidad().catch((error) => {
        console.error('Error al actualizar publicaciones caducadas:', error);
      });
    }, 60_000).unref();

    // 3. Inicio del servidor HTTP
    app.listen(PORT, () => {
      console.log('====================================================');
      console.log(`🚀 ECO-GOLGI BACKEND CORRIENDO EN PUERTO: ${PORT}`);
      console.log(`📌 SALUD:           http://localhost:${PORT}/api/salud`);
      console.log(`📌 PUBLICACIONES:   http://localhost:${PORT}/api/publicaciones`);
      console.log(`📌 ARTÍCULOS:       http://localhost:${PORT}/api/articulos`);
      console.log(`📌 SOLICITUDES:     http://localhost:${PORT}/api/solicitudes`);
      console.log(`📌 NOTIFICACIONES:  http://localhost:${PORT}/api/notificaciones`);
      console.log(`📌 AUTENTICACIÓN:   http://localhost:${PORT}/api/auth/login`);
      console.log(`📚 DOCUMENTACIÓN:   http://localhost:${PORT}/api/docs`);
      console.log('====================================================');
    });
  } catch (error) {
    console.error('Error al arrancar el servidor:', error.message);
    process.exit(1);
  }
}

iniciarServidor();
