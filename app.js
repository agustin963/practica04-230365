import express from 'express';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment-timezone';
import os from 'os';
import './databases.js';
import Session from './models.sessions.js';
import { encryptionService } from './encryption.js';

const app = express();
const PORT = 3500;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});

app.use(
  session({
    secret: "P4-MAR#panconhuevo230365",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 5 * 60 * 1000 }
  })
);

// Función para obtener la IP del servidor
const getServerIP = () => {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      // Busca una IPv4 que no sea interna
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  // Si no encuentra una IP externa, retorna la IP local
  return '127.0.0.1';
};

// Función para obtener la IP del cliente
const getClientIP = (req) => {
  // Primero verifica el encabezado x-forwarded-for (para clientes detrás de proxy/balanceador de carga)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // Obtiene la primera IP en caso de que haya múltiples IPs reenviadas
    const firstIP = forwardedFor.split(',')[0].trim();
    // Si es una IP válida, la retorna
    if (firstIP && firstIP !== '::1' && firstIP !== 'undefined') {
      return firstIP;
    }
  }
  
  // Verifica la dirección remota de la conexión
  const remoteAddress = req.connection.remoteAddress;
  if (remoteAddress) {
    // Maneja casos especiales de localhost
    if (remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1') {
      return '127.0.0.1';
    }
    // Elimina el prefijo IPv6 si está presente
    return remoteAddress.replace(/^::ffff:/, '');
  }
  
  // Verifica la dirección del socket
  const socketAddress = req.socket.remoteAddress;
  if (socketAddress) {
    // Maneja casos especiales de localhost
    if (socketAddress === '::1' || socketAddress === '::ffff:127.0.0.1') {
      return '127.0.0.1';
    }
    return socketAddress.replace(/^::ffff:/, '');
  }
  
  // Como última opción, retorna desconocido
  return 'Desconocido';
};

// Cerrar sesiones inactivas cada 2 minutos
setInterval(async () => {
  const twoMinutesAgo = moment().subtract(2, 'minutes').tz("America/Mexico_City").format();
  await Session.updateMany(
    { lastAccessed: { $lte: twoMinutesAgo }, status: "Activa" },
    { status: "Cerrado por el sistema" }
  );
}, 60000);

app.get('/', (request, response) => {
  return response.status(200).json({
    message: "Bienvenido al control de sesiones",
    autor: "Jose Agustin"
  });
});

// Crear sesión (CREATE)
app.post('/login', async (req, res) => {
  const { email, nickname, macAddress } = req.body;
  if (!email || !nickname || !macAddress) {
    return res.status(400).json({ message: "Se esperan campos email, nickname, y macAddress." });
  }

  try {
    const sessionId = uuidv4();
    const now = moment().tz("America/Mexico_City").format("YYYY-MM-DD hh:mm:ss A");

    const clientIP = getClientIP(req);
    const serverIP = getServerIP();

    const encryptedData = encryptionService.encryptSessionData({
      email,
      nickname,
      macAddress,
      clientIP,
      serverIP
    });

    await Session.create({
      sessionId,
      ...encryptedData,
      status: "Activa",
      createdAt: now,
      lastAccessed: now
    });

    return res.status(200).json({ 
      message: "Sesión iniciada correctamente", 
      sessionId,
      // clientIP,
      // serverIP
    });
  } catch (error) {
    return res.status(500).json({ message: "Error al guardar la sesión", error });
  }
});

// Obtener estado de sesión (READ)
app.get("/status", async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId." });
  }
  try {
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: "No se encontró la sesión." });
    }

    const decryptedSession = encryptionService.decryptSessionData(session);

    return res.status(200).json({
      message: "Sesión encontrada",
      session: {
        ...decryptedSession,
        _id: session._id,
        __v: session.__v
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar la sesión", error });
  }
});

// Obtener todas las sesiones
app.get("/allSessions", async (req, res) => {
  try {
    const sessions = await Session.find().lean();
    
    if (!sessions || sessions.length === 0) {
      return res.status(404).json({
        message: "No se encontraron sesiones",
        sessions: []
      });
    }

    const decryptedSessions = sessions.map(session => {
      try {
        const decryptedData = encryptionService.decryptSessionData(session);
        return {
          ...decryptedData,
          createdAt: session.createdAt ? 
            moment(session.createdAt).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss') : 
            'Fecha no disponible',
          lastAccessed: session.lastAccessed ? 
            moment(session.lastAccessed).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss') : 
            'Fecha no disponible'
        };
      } catch (error) {
        return {
          sessionId: session.sessionId,
          status: session.status,
          error: 'Error al procesar datos de la sesión'
        };
      }
    });

    return res.status(200).json({
      message: "Sesiones recuperadas exitosamente",
      totalSessions: decryptedSessions.length,
      sessions: decryptedSessions
    });
  } catch (error) {
    console.error('Error en /allSessions:', error);
    return res.status(500).json({ 
      message: "Error al obtener las sesiones", 
      error: error.message 
    });
  }
});

// Obtener todas las sesiones activas
app.get("/allCurrentSessions", async (req, res) => {
  try {
    const activeSessions = await Session.find({ status: "Activa" }).lean();

    if (!activeSessions || activeSessions.length === 0) {
      return res.status(404).json({
        message: "No hay sesiones activas",
        sessions: []
      });
    }

    const decryptedSessions = activeSessions.map(session => {
      try {
        const decryptedData = encryptionService.decryptSessionData(session);
        return {
          ...decryptedData,
          createdAt: session.createdAt ? 
            moment(session.createdAt).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss') : 
            'Fecha no disponible',
          lastAccessed: session.lastAccessed ? 
            moment(session.lastAccessed).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss') : 
            'Fecha no disponible'
        };
      } catch (error) {
        return {
          sessionId: session.sessionId,
          status: session.status,
          error: 'Error al procesar datos de la sesión'
        };
      }
    });

    return res.status(200).json({
      message: "Sesiones activas recuperadas exitosamente",
      totalActiveSessions: decryptedSessions.length,
      sessions: decryptedSessions
    });
  } catch (error) {
    console.error('Error en /allCurrentSessions:', error);
    return res.status(500).json({ 
      message: "Error al obtener las sesiones activas", 
      error: error.message 
    });
  }
});

// Actualizar sesión (UPDATE)
app.put('/update', async (req, res) => {
  const { sessionId, status } = req.body;
  if (!sessionId || !status) {
    return res.status(400).json({ message: "Se requiere sessionId y status para actualizar." });
  }
  try {
    const session = await Session.findOneAndUpdate(
      { sessionId },
      { status, lastAccessed: moment().tz("America/Mexico_City").format() },
      { new: true }
    );
    if (!session) {
      return res.status(404).json({ message: "No se encontró la sesión." });
    }
    return res.status(200).json({ message: "Sesión actualizada correctamente", session });
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar la sesión", error });
  }
});

// Cerrar sesión (UPDATE)
app.post("/logout", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId para cerrar sesión." });
  }
  try {
    const session = await Session.findOneAndUpdate(
      { sessionId },
      { status: "Cerrada por el Usuario", lastAccessed: moment().tz("America/Mexico_City").format() },
      { new: true }
    );
    if (!session) {
      return res.status(404).json({ message: "No se encontró la sesión." });
    }
    return res.status(200).json({ message: "Sesión cerrada correctamente." });
  } catch (error) {
    return res.status(500).json({ message: "Error al cerrar sesión", error });
  }
});

// Eliminar todas las sesiones
app.delete("/deleteAllSessions", async (req, res) => {
  try {
    await Session.deleteMany({});
    return res.status(200).json({ message: "Todas las sesiones han sido eliminadas." });
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar todas las sesiones", error });
  }
});