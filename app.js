import express from 'express';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment-timezone';
import os from 'os';
import './databases.js';
import Session from './models.sessions.js';

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

// Función para obtener la MAC address del servidor
const getServerMAC = () => {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.mac;
      }
    }
  }
  return 'Unknown MAC';
};

// Función para obtener la IP del servidor
const getServerIP = () => {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
};

// Función para obtener la IP del cliente
const getClientIP = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const firstIP = forwardedFor.split(',')[0].trim();
    if (firstIP && firstIP !== '::1' && firstIP !== 'undefined') {
      return firstIP;
    }
  }
  
  const remoteAddress = req.connection.remoteAddress;
  if (remoteAddress) {
    if (remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1') {
      return '127.0.0.1';
    }
    return remoteAddress.replace(/^::ffff:/, '');
  }
  
  const socketAddress = req.socket.remoteAddress;
  if (socketAddress) {
    if (socketAddress === '::1' || socketAddress === '::ffff:127.0.0.1') {
      return '127.0.0.1';
    }
    return socketAddress.replace(/^::ffff:/, '');
  }
  
  return 'Desconocido';
};

// Función para calcular la duración y tiempo inactivo
const calculateSessionTimes = (session) => {
  const now = new Date();
  const lastAccessed = new Date(session.lastAccessed);
  const inactiveTime = Math.floor((now - lastAccessed) / 1000); // Convertir a segundos
  
  // Si la sesión está activa, actualizar la duración
  if (session.status === "Activa") {
    const createdAt = new Date(session.timestamp);
    const duration = Math.floor((now - createdAt) / 1000); // Convertir a segundos
    return { inactive: inactiveTime, duration };
  }
  
  return { inactive: session.inactive, duration: session.duration };
};

// Cerrar sesiones inactivas cada 2 minutos
setInterval(async () => {
  const twoMinutesAgo = moment().subtract(2, 'minutes').toDate();
  const activeSessions = await Session.find({ 
    lastAccessed: { $lte: twoMinutesAgo }, 
    status: "Activa" 
  });

  for (const session of activeSessions) {
    const times = calculateSessionTimes(session);
    await Session.findByIdAndUpdate(session._id, {
      status: "Cerrado por el sistema",
      inactive: times.inactive,
      duration: times.duration
    });
  }
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
    const clientIP = getClientIP(req);
    const serverIP = getServerIP();
    const serverMAC = getServerMAC();

    const sessionData = {
      sessionId,
      email,
      nickname,
      status: "Activa",
      clientData: {
        ip: clientIP,
        macAddress
      },
      serverData: {
        ip: serverIP,
        macAddress: serverMAC
      },
      timestamp: new Date(),
      lastAccessed: new Date(),
      inactive: 0,
      duration: 0
    };

    const newSession = await Session.create(sessionData);

    return res.status(200).json({ 
      message: "Sesión iniciada correctamente", 
      sessionId 
    });
  } catch (error) {
    return res.status(500).json({ message: "Error al guardar la sesión", error });
  }
});

// Obtener estado de sesión
app.get("/status", async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId." });
  }
  try {
    const session = await Session.findOne({ sessionId }).lean();
    if (!session) {
      return res.status(404).json({ message: "No se encontró la sesión." });
    }

    // Calcular tiempos actualizados si la sesión está activa
    let times = { inactive: session.inactive, duration: session.duration };
    if (session.status === "Activa") {
      times = calculateSessionTimes(session);
    }

    const formattedSession = {
      ...session,
      inactive: times.inactive,
      duration: times.duration,
      timestamp: moment(session.timestamp).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
      lastAccessed: moment(session.lastAccessed).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
      createdAt: moment(session.createdAt).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: moment(session.updatedAt).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')
    };

    return res.status(200).json({
      message: "Sesión encontrada",
      session: formattedSession
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

    const formattedSessions = sessions.map(session => {
      // Calcular tiempos actualizados si la sesión está activa
      let times = { inactive: session.inactive, duration: session.duration };
      if (session.status === "Activa") {
        times = calculateSessionTimes(session);
      }

      return {
        ...session,
        inactive: times.inactive,
        duration: times.duration,
        timestamp: moment(session.timestamp).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
        lastAccessed: moment(session.lastAccessed).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
        createdAt: moment(session.createdAt).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: moment(session.updatedAt).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')
      };
    });

    return res.status(200).json({
      message: "Sesiones recuperadas exitosamente",
      totalSessions: formattedSessions.length,
      sessions: formattedSessions
    });
  } catch (error) {
    console.error('Error en /allSessions:', error);
    return res.status(500).json({ 
      message: "Error al obtener las sesiones", 
      error: error.message 
    });
  }
});

// Obtener sesiones activas
app.get("/allCurrentSessions", async (req, res) => {
  try {
    const activeSessions = await Session.find({ status: "Activa" }).lean();

    if (!activeSessions || activeSessions.length === 0) {
      return res.status(404).json({
        message: "No hay sesiones activas",
        sessions: []
      });
    }

    const formattedSessions = activeSessions.map(session => {
      const times = calculateSessionTimes(session);
      return {
        ...session,
        inactive: times.inactive,
        duration: times.duration,
        timestamp: moment(session.timestamp).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
        lastAccessed: moment(session.lastAccessed).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
        createdAt: moment(session.createdAt).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: moment(session.updatedAt).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')
      };
    });

    return res.status(200).json({
      message: "Sesiones activas recuperadas exitosamente",
      totalActiveSessions: formattedSessions.length,
      sessions: formattedSessions
    });
  } catch (error) {
    console.error('Error en /allCurrentSessions:', error);
    return res.status(500).json({ 
      message: "Error al obtener las sesiones activas", 
      error: error.message 
    });
  }
});

// Actualizar sesión
app.put('/update', async (req, res) => {
  const { sessionId, status } = req.body;
  if (!sessionId || !status) {
    return res.status(400).json({ message: "Se requiere sessionId y status para actualizar." });
  }
  try {
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: "No se encontró la sesión." });
    }

    const times = calculateSessionTimes(session);
    const updateData = {
      status,
      lastAccessed: new Date(),
      inactive: 0, // Reiniciar tiempo de inactividad
      duration: times.duration // Mantener la duración acumulada
    };

    const updatedSession = await Session.findOneAndUpdate(
      { sessionId },
      updateData,
      { new: true }
    );

    return res.status(200).json({ 
      message: "Sesión actualizada correctamente", 
      session: updatedSession 
    });
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar la sesión", error });
  }
});

// Cerrar sesión
app.post("/logout", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId para cerrar sesión." });
  }
  try {
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: "No se encontró la sesión." });
    }

    const times = calculateSessionTimes(session);
    const updatedSession = await Session.findOneAndUpdate(
      { sessionId },
      {
        status: "Cerrada por el Usuario",
        lastAccessed: new Date(),
        inactive: times.inactive,
        duration: times.duration
      },
      { new: true }
    );

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

export default app;