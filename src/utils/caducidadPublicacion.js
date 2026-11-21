const MILISEGUNDOS_POR_DIA = 86_400_000;
const ESTADOS_ACTIVOS = ['Disponible', 'Reservado'];

function calcularDiasTranscurridos(publicacion, ahora = new Date()) {
  const fechaPublicacion = new Date(publicacion.createdAt || publicacion.publishedAt);
  const diasDesdeFecha = Number.isNaN(fechaPublicacion.getTime())
    ? 0
    : Math.floor((ahora.getTime() - fechaPublicacion.getTime()) / MILISEGUNDOS_POR_DIA);
  const diasGuardados = Number(publicacion.daysElapsed);

  return Math.max(Number.isFinite(diasGuardados) ? diasGuardados : 0, diasDesdeFecha, 0);
}

function estaCaducada(publicacion, ahora = new Date()) {
  const expirationDays = Number(publicacion.expirationDays ?? 30);
  return ESTADOS_ACTIVOS.includes(publicacion.status)
    && Number.isFinite(expirationDays)
    && calcularDiasTranscurridos(publicacion, ahora) >= expirationDays;
}

function calcularDiasRestantes(publicacion, ahora = new Date()) {
  const expirationDays = Number(publicacion.expirationDays ?? 30);
  return Math.max(0, expirationDays - calcularDiasTranscurridos(publicacion, ahora));
}

module.exports = {
  calcularDiasTranscurridos,
  calcularDiasRestantes,
  estaCaducada,
};
