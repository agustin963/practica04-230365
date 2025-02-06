import express from 'express';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment-timezone';
import os from "os";
import './databases.js';
import Session from './models.sessions.js';

const app = express();
const PORT = 3500;



app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "P4-MAR#panconhuevo230365",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 5 * 60 * 1000 }  
  })
);

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
});

// Obtener IP local
const getLocalIP = () => {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
};

// ✅ **Crear sesión (Login y Guardar en MongoDB)**
app.post('/login', async (req, res) => {
  const { email, nickname, macAddress } = req.body;

  if (!email || !nickname || !macAddress) {
    return res.status(400).json({ message: "Se esperan campos email, nickname, y macAddress." });
  }

  const sessionId = uuidv4();
  const now = moment().tz("America/Mexico_City").format();
  const ip = getLocalIP();

  const newSession = new Session({
    sessionId,
    email,
    nickname,
    macAddress,
    ip,
    createdAt: now,
    lastAccessed: now
  });

  try {
    await newSession.save();
    return res.status(200).json({ message: "Sesión iniciada correctamente", sessionId });
  } catch (error) {
    return res.status(500).json({ message: "Error al guardar la sesión", error });
  }
});

// ✅ **Cerrar sesión (Eliminar de MongoDB)**
app.post("/logout", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId para cerrar sesión." });
  }

  try {
    const deletedSession = await Session.findOneAndDelete({ sessionId });
    if (!deletedSession) {
      return res.status(404).json({ message: "No se encontró la sesión." });
    }

    return res.status(200).json({ message: "Sesión cerrada correctamente." });
  } catch (error) {
    return res.status(500).json({ message: "Error al cerrar sesión", error });
  }
});

// ✅ **Actualizar sesión**
app.put('/update', async (req, res) => {
  const { sessionId, nickname, email, macAddress } = req.body;

  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId para actualizar." });
  }

  try {
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: "No se encontró la sesión." });
    }

    if (nickname) session.nickname = nickname;
    if (email) session.email = email;
    if (macAddress) session.macAddress = macAddress;
    session.lastAccessed = moment().tz("America/Mexico_City").format();

    await session.save();
    return res.status(200).json({ message: "Datos actualizados correctamente.", session });
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar la sesión", error });
  }
});

// ✅ **Ver el estado de una sesión**
app.get("/status", async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId." });
  }

  try {
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: "No se encontró la sesión activa." });
    }

    return res.status(200).json({ message: "Sesión activa.", session });
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar la sesión", error });
  }
});

// ✅ **Listar todas las sesiones activas**
app.get('/listCurrentSessions', async (req, res) => {
  try {
    const sessions = await Session.find();

    if (sessions.length === 0) {
      return res.status(404).json({ message: "No hay sesiones activas." });
    }

    const sessionList = sessions.map(session => ({
      nickname: session.nickname,
      sessionID: session.sessionId,
      email: session.email,
      ipSolicitud: session.ip,
      ipRespuesta: getLocalIP(),
      inicio: moment(session.createdAt).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
      ultimoAcceso: moment(session.lastAccessed).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')
    }));

    return res.status(200).json({ message: 'Listado de sesiones activas', sesiones: sessionList });
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener las sesiones", error });
  }
});
