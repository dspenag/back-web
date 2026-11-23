const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');

test('connectDB comparte el intento de conexión de solicitudes concurrentes', async (t) => {
  const connectOriginal = mongoose.connect;
  const originalUri = process.env.MONGO_URI;
  const originalDatabaseName = process.env.MONGO_DB_NAME;
  const originalVercel = process.env.VERCEL;
  let llamadas = 0;
  let opciones;
  const conexion = { connection: { host: 'test', name: 'ecogolgi' } };

  t.after(() => {
    mongoose.connect = connectOriginal;
    if (originalUri === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = originalUri;
    if (originalDatabaseName === undefined) delete process.env.MONGO_DB_NAME;
    else process.env.MONGO_DB_NAME = originalDatabaseName;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  process.env.MONGO_URI = 'mongodb://test.invalid';
  process.env.MONGO_DB_NAME = 'pruebas';
  delete process.env.VERCEL;
  mongoose.connect = async (_, ajustes) => {
    llamadas += 1;
    opciones = ajustes;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return conexion;
  };

  const [primera, segunda] = await Promise.all([connectDB(), connectDB()]);

  assert.equal(llamadas, 1);
  assert.equal(primera, conexion);
  assert.equal(segunda, conexion);
  assert.equal(opciones.dbName, 'pruebas');
  assert.equal(opciones.maxPoolSize, 5);
});
