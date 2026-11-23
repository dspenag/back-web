require('dotenv').config();
const mongoose = require('mongoose');
const Publicacion = require('../src/models/publicacion.models');
const { connectDB } = require('../src/config/db');

const codigosSemilla = Array.from({ length: 37 }, (_, i) => `PRN-${String(i + 1).padStart(3, '0')}`);

async function limpiarPublicacionesSemilla() {
  await connectDB();

  const filtro = { codigo: { $in: codigosSemilla } };
  const encontradas = await Publicacion.countDocuments(filtro);
  if (!process.argv.includes('--apply')) {
    console.log(`Vista previa: ${encontradas} publicaciones semilla coinciden. No se eliminó ningún registro.`);
    console.log('Para eliminarlas, ejecuta el comando con -- --apply.');
    return;
  }

  const resultado = await Publicacion.deleteMany(filtro);
  console.log(`Publicaciones semilla eliminadas: ${resultado.deletedCount}.`);
}

limpiarPublicacionesSemilla()
  .catch((error) => {
    console.error(`No se pudo completar la limpieza (${error.name}${error.code ? `, código ${error.code}` : ''}).`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
