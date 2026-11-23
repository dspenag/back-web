const Publicacion = require('../models/publicacion.models');
const Solicitud = require('../models/solicitud.models');
const Favorito = require('../models/favorito.models');
const HttpError = require('../utils/HttpError');
const { guardarImagenesPublicacion, eliminarImagenesPublicacion } = require('../utils/imagenesPublicacion');
const { calcularDiasTranscurridos, estaCaducada } = require('../utils/caducidadPublicacion');

const ESTADOS_NO_DISPONIBLES = ['Donado', 'Intercambiado'];

async function listar(filtros = {}) {
  await sincronizarCaducidad();
  const query = {};

  // Filtro por categoría (ej: 'ROPA', 'LIBROS', 'CALZADO')
  if (filtros.categoria && filtros.categoria !== 'Todas' && filtros.categoria !== 'TODAS') {
    query.category = new RegExp(`^${filtros.categoria.trim()}$`, 'i');
  }

  // Filtro por estado (ej: 'Disponible', 'Reservado', 'Donado', 'Caducado')
  if (filtros.estado && filtros.estado !== 'Todos' && filtros.estado !== 'TODOS') {
    query.status = filtros.estado;
  } else {
    query.status = { $nin: ESTADOS_NO_DISPONIBLES };
  }

  // Filtro por modalidad (ej: 'Donación', 'Intercambio')
  if (filtros.modalidad && filtros.modalidad !== 'Todas') {
    query.modality = new RegExp(`^${filtros.modalidad.trim()}$`, 'i');
  }

  // Búsqueda general (q o busqueda)
  const termino = filtros.q || filtros.busqueda;
  if (termino && termino.trim() !== '') {
    const regExp = new RegExp(termino.trim(), 'i');
    query.$or = [
      { title: regExp },
      { description: regExp },
      { details: regExp },
      { category: regExp },
      { tags: regExp },
      { author: regExp },
    ];
  }

  const publicaciones = await Publicacion.find(query).sort({ createdAt: -1 });
  return publicaciones.map(serializarPublicacion);
}

async function listarDeUsuario(usuarioId) {
  await sincronizarCaducidad();
  const publicaciones = await Publicacion.find({
    usuarioId,
    status: { $ne: 'Intercambiado' },
  }).sort({ createdAt: -1 });
  return publicaciones.map(serializarPublicacion);
}

async function obtener(id) {
  await sincronizarCaducidad();
  const publicacion = await Publicacion.findById(id);
  if (!publicacion) {
    throw new HttpError(404, 'Publicación no encontrada');
  }
  return serializarPublicacion(publicacion);
}

function serializarPublicacion(publicacion) {
  return {
    ...publicacion.toJSON(),
    daysElapsed: calcularDiasTranscurridos(publicacion),
    expirationDays: publicacion.expirationDays ?? 30,
  };
}

async function sincronizarCaducidad() {
  const publicacionesActivas = await Publicacion.find({
    status: { $in: ['Disponible', 'Reservado'] },
  })
    .select('_id status createdAt publishedAt daysElapsed expirationDays')
    .lean();
  const idsCaducados = publicacionesActivas
    .filter((publicacion) => estaCaducada(publicacion))
    .map((publicacion) => publicacion._id);

  if (idsCaducados.length > 0) {
    await Publicacion.updateMany(
      { _id: { $in: idsCaducados }, status: { $in: ['Disponible', 'Reservado'] } },
      { $set: { status: 'Caducado' } }
    );
  }
}

async function crear(datos) {
  const { images, ...datosPublicacion } = datos;
  const imagenesGuardadas = images?.length
    ? await guardarImagenesPublicacion(images)
    : [];
  const urls = imagenesGuardadas.map((imagen) => imagen.url);
  let creada;

  try {
    const nueva = new Publicacion({
      ...datosPublicacion,
      ...(urls.length > 0 ? { imageUrl: urls[0], imageUrls: urls } : {}),
    });
    creada = await nueva.save();
  } catch (error) {
    await eliminarImagenesPublicacion(imagenesGuardadas);
    throw error;
  }

  await sincronizarCaducidad();
  return await obtener(creada.id);
}

async function actualizar(id, cambios, usuario) {
  const publicacion = await Publicacion.findById(id);
  if (!publicacion) {
    throw new HttpError(404, 'Publicación no encontrada');
  }

  // Validación de permisos si se provee usuario
  if (usuario) {
    const esAdmin = usuario.role === 'admin' || usuario.role === 'Administrador';
    const esDuenio = publicacion.usuarioId && publicacion.usuarioId.toString() === (usuario._id || usuario.id).toString();
    const coincideAutor = publicacion.author && usuario.nombre && publicacion.author.toLowerCase() === usuario.nombre.toLowerCase();

    if (!esAdmin && publicacion.usuarioId && !esDuenio && !coincideAutor) {
      throw new HttpError(403, 'No tienes permisos para modificar esta publicación');
    }
  }

  Object.assign(publicacion, cambios);
  await publicacion.save();
  await sincronizarCaducidad();
  return await obtener(id);
}

async function eliminar(id, usuario) {
  const publicacion = await Publicacion.findById(id);
  if (!publicacion) {
    throw new HttpError(404, 'Publicación no encontrada');
  }

  if (usuario && usuario.role !== 'admin' && usuario.role !== 'Administrador') {
    if (publicacion.usuarioId && String(publicacion.usuarioId) !== String(usuario._id || usuario.id)) {
      throw new HttpError(403, 'No tienes permiso para eliminar esta publicación');
    }
  }

  if (Array.isArray(publicacion.imageUrls) && publicacion.imageUrls.length > 0) {
    try {
      await eliminarImagenesPublicacion(publicacion.imageUrls);
    } catch (e) {
      console.warn('Error al limpiar imágenes de publicación eliminada:', e.message);
    }
  }

  await Favorito.deleteMany({ articuloId: id });
  const eliminada = await Publicacion.findByIdAndDelete(id);
  return eliminada;
}

async function obtenerEstadisticas() {
  await sincronizarCaducidad();
  const [
    articulosDisponibles,
    intercambiosSolicitud,
    intercambiosPublicacion,
    donacionesSolicitud,
    donacionesPublicacion,
    caducadosPublicacion,
  ] = await Promise.all([
    Publicacion.countDocuments({ status: { $nin: ESTADOS_NO_DISPONIBLES } }),
    Solicitud.countDocuments({
      type: { $regex: /inter/i },
      status: { $in: ['Donado', 'Aceptado'] },
    }),
    Publicacion.countDocuments({
      modality: { $regex: /inter/i },
      status: { $in: ['Donado', 'Intercambiado'] },
    }),
    Solicitud.countDocuments({
      type: { $regex: /dona/i },
      status: 'Donado',
    }),
    Publicacion.countDocuments({
      modality: { $regex: /dona/i },
      status: 'Donado',
    }),
    Publicacion.countDocuments({
      status: 'Caducado',
    }),
  ]);

  const intercambiosLocales = Math.max(intercambiosSolicitud, intercambiosPublicacion);
  const escaladosUnidona = Math.max(
    donacionesSolicitud + caducadosPublicacion,
    donacionesPublicacion + caducadosPublicacion
  );
  const totalCirculados = articulosDisponibles + intercambiosLocales + escaladosUnidona;
  const residuosEvitadosKg = Math.round(totalCirculados * 2.5);

  return {
    articulosDisponibles,
    intercambiosLocales,
    escaladosUnidona,
    residuosEvitadosKg,
  };
}

module.exports = {
  listar,
  listarDeUsuario,
  obtener,
  crear,
  actualizar,
  eliminar,
  obtenerEstadisticas,
  sincronizarCaducidad,
};
