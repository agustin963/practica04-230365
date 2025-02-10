import express from 'express';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment-timezone';
import os from "os";
import './databases.js';
import Session from './models.sessions.js';
import NodeRSA from 'node-rsa';

// Generar un nuevo par de claves RSA
const key = new NodeRSA({ b: 512 });

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
  console.log(` Servidor iniciado en http://localhost:${PORT}`);
});

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

// Cerrar sesiones inactivas después de 2 minutos
setInterval(async () => {
  const twoMinutesAgo = moment().subtract(2, 'minutes').tz("America/Mexico_City").format();
  await Session.updateMany(
    { lastAccessed: { $lte: twoMinutesAgo }, status: "Activa" },
    { status: "Cerrado por el sistema" }
  );
}, 60000); // Se ejecuta cada minuto

// Crear sesión (CREATE)
app.post('/login', async (req, res) => {
  const { email, nickname, macAddress } = req.body;
  if (!email || !nickname || !macAddress) {
    return res.status(400).json({ message: "Se esperan campos email, nickname, y macAddress." });
  }
  const sessionId = uuidv4();
  const now = moment().tz("America/Mexico_City").format();
  const ip = getLocalIP();

  try {
    const encryptedEmail = key.encrypt(email, 'base64');
    const encryptedNickname = key.encrypt(nickname, 'base64');
    const encryptedMacAddress = key.encrypt(macAddress, 'base64');
    const encryptedIp = key.encrypt(ip, 'base64');
    await Session.create({
      sessionId,
      email: encryptedEmail,
      nickname: encryptedNickname,
      macAddress: encryptedMacAddress,
      ip: encryptedIp,
      status: "Activa",
      createdAt: now,
      lastAccessed: now
    });
    return res.status(200).json({ message: "Sesión iniciada correctamente", sessionId });
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

    // Descifrar datos de la sesión
    const decryptedEmail = key.decrypt(session.email, 'utf8');
    const decryptedNickname = key.decrypt(session.nickname, 'utf8');
    const decryptedMacAddress = key.decrypt(session.macAddress, 'utf8');
    const decryptedIp = key.decrypt(session.ip, 'utf8');

    return res.status(200).json({
      message: "Sesión encontrada",
      session: {
        ...session._doc,
        email: decryptedEmail,
        nickname: decryptedNickname,
        macAddress: decryptedMacAddress,
        ip: decryptedIp
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar la sesión", error });
  }
});



app.get("/allSessions", async (req, res) => {
  try {
    const sessions = await Session.find();

    // Descifrar datos de todas las sesiones
    const decryptedSessions = sessions.map(session => ({
      sessionId: session.sessionId,
      email: key.decrypt(session.email, 'utf8'),
      nickname: key.decrypt(session.nickname, 'utf8'),
      macAddress: key.decrypt(session.macAddress, 'utf8'),
      status: session.status,
      ip: key.decrypt(session.ip, 'utf8'),
      createdAt: moment(session.createdAt).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
      lastAccessed: moment(session.lastAccessed).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')
    }));

    return res.status(200).json({
      message: "Sesiones ",
      Sessions: decryptedSessions
    });
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener las sesiones", error });
  }
});

// Endpoint para obtener todas las sesiones activas (ALL CURRENT SESSIONS)
app.get("/allCurrentSessions", async (req, res) => {
  try {
    const activeSessions = await Session.find({ status: "Activa" });

    if (activeSessions.length === 0) {
      return res.status(404).json({ message: "No hay sesiones activas." });
    }

    // Descifrar datos de todas las sesiones activas
    const decryptedSessions = activeSessions.map(session => ({
      sessionId: session.sessionId,
      email: key.decrypt(session.email, 'utf8'),
      nickname: key.decrypt(session.nickname, 'utf8'),
      macAddress: key.decrypt(session.macAddress, 'utf8'),
      status: session.status,
      ip: key.decrypt(session.ip, 'utf8'),
      createdAt: moment(session.createdAt).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
      lastAccessed: moment(session.lastAccessed).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')
    }));

    return res.status(200).json({
      message: "Sesiones activas",
      sessions: decryptedSessions
    });
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener las sesiones activas", error });
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
      { status: "Inactiva", lastAccessed: moment().tz("America/Mexico_City").format() },
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

// Eliminar todas las sesiones (PELIGROSO!)
app.delete("/deleteAllSessions", async (req, res) => {
  try {
    await Session.deleteMany({});
    return res.status(200).json({ message: "Todas las sesiones han sido eliminadas." });
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar todas las sesiones", error });
  }
});
