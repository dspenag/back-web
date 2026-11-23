const mongoose = require('mongoose');
const dns = require('dns');

// Solo en local (Windows), las consultas SRV de MongoDB Atlas a veces fallan con ECONNREFUSED
if (!process.env.VERCEL) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {
    // Ignorar si el entorno del sistema no permite reasignar servidores DNS
  }
}

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  try {
    const uri = process.env.MONGO_URI;

    if (!uri) {
      const msg = 'La variable de entorno MONGO_URI no está definida.';
      console.error(`❌ ERROR: ${msg}`);
      if (process.env.VERCEL) throw new Error(msg);
      process.exit(1);
      return;
    }

    if (uri.includes('<USUARIO>') || uri.includes('<PASSWORD>')) {
      const msg = 'Debes reemplazar <USUARIO> y <PASSWORD> con tus credenciales de MongoDB Atlas.';
      console.error(`⚠️ ATENCIÓN: ${msg}`);
      if (process.env.VERCEL) throw new Error(msg);
      process.exit(1);
      return;
    }

    if (!cached.promise) {
      cached.promise = mongoose
        .connect(uri, {
          dbName: process.env.MONGO_DB_NAME || 'ecogolgi',
          maxPoolSize: 5,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 30000,
        })
        .then((conn) => {
          cached.conn = conn;
          console.log(`🌐 MongoDB Atlas conectado exitosamente: ${conn.connection.host}/${conn.connection.name}`);
          return conn;
        })
        .finally(() => {
          cached.promise = null;
        });
    }

    return await cached.promise;
  } catch (error) {
    cached.conn = null;
    cached.promise = null;
    console.error('❌ Error al conectar con MongoDB Atlas:', error.message);
    if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
      console.error('👉 Tip: Revisa que tu usuario y contraseña de MongoDB Atlas sean correctos.');
    } else if (error.message.includes('queryTxt') || error.message.includes('ENOTFOUND')) {
      console.error('👉 Tip: Revisa la URI SRV de Atlas y la resolución DNS del entorno.');
    } else if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNRESET')) {
      console.error('👉 Tip: Revisa Network Access de Atlas y las restricciones de salida de red de Vercel.');
    }
    if (process.env.VERCEL) throw error;
    process.exit(1);
  }
}

module.exports = {
  connectDB,
  conectarDB: connectDB,
};
