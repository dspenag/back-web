const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularDiasRestantes,
  estaCaducada,
} = require('../src/utils/caducidadPublicacion');

test('una publicación activa con cero días de duración caduca inmediatamente', () => {
  assert.equal(estaCaducada({
    status: 'Disponible',
    daysElapsed: 0,
    expirationDays: 0,
  }), true);
});

test('una publicación reservada caduca al alcanzar los días configurados', () => {
  const ahora = new Date('2026-11-20T12:00:00.000Z');
  assert.equal(estaCaducada({
    status: 'Reservado',
    createdAt: new Date('2026-11-18T12:00:00.000Z'),
    daysElapsed: 0,
    expirationDays: 2,
  }, ahora), true);
});

test('las publicaciones donadas no vuelven a marcarse como caducadas', () => {
  assert.equal(estaCaducada({
    status: 'Donado',
    daysElapsed: 30,
    expirationDays: 0,
  }), false);
});

test('cero días de duración no se sustituye por el valor de respaldo', () => {
  assert.equal(calcularDiasRestantes({
    status: 'Disponible',
    daysElapsed: 0,
    expirationDays: 0,
  }), 0);
});
