const test = require('node:test');
const assert = require('node:assert/strict');
const Publicacion = require('../src/models/publicacion.models');
const { sincronizarCaducidad } = require('../src/services/publicaciones.service');

test('sincronizar caducidad consulta solo campos necesarios y no carga imágenes', async (t) => {
  const findOriginal = Publicacion.find;
  const updateManyOriginal = Publicacion.updateMany;
  const actualizacion = {};
  let camposSeleccionados;

  t.after(() => {
    Publicacion.find = findOriginal;
    Publicacion.updateMany = updateManyOriginal;
  });

  Publicacion.find = () => ({
    select(campos) {
      camposSeleccionados = campos;
      return this;
    },
    lean: async () => [{
      _id: 'caducada',
      status: 'Disponible',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
      daysElapsed: 0,
      expirationDays: 1,
    }],
  });
  Publicacion.updateMany = async (filtro, cambios) => {
    actualizacion.filtro = filtro;
    actualizacion.cambios = cambios;
  };

  await sincronizarCaducidad();

  assert.equal(camposSeleccionados, '_id status createdAt publishedAt daysElapsed expirationDays');
  assert.deepEqual(actualizacion.filtro._id.$in, ['caducada']);
  assert.deepEqual(actualizacion.cambios.$set, { status: 'Caducado' });
});
