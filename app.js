import express from 'express';
import session from 'express-session';  
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment-timezone';
import os from "os";

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
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});

app.get('/', (request, response) => {
  return response.status(200).json({
    message: "Bienvenido al control de sesiones",
    autor: "Jose Agustin"
  });
});

const getLocalIP = () => {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;  // Retorna la IP local
      }
    }
  }
  return null;
};

const sessions = {}; // Almacena las sesiones iniciadas

app.post('/login', (request, response) => {
  const { email, nickname, macAddress } = request.body;

  if (!email || !nickname || !macAddress) {
    return response.status(400).json({ message: "Se esperan campos email, nickname, y macAddress." });
  }

  const sessionId = uuidv4();
  const now = new Date();

  request.session.user = {
    sessionId,
    email,
    nickname,
    macAddress,
    ip: getLocalIP(),
    createdAt: now,
    lastAccessed: now
  };

  // Guarda la sesión en el objeto sessions
  sessions[sessionId] = request.session.user;

  console.log('Sesión iniciada:', sessions[sessionId]); // Verificar si la sesión se guarda correctamente

  return response.status(200).json({ message: "Sesión iniciada correctamente", sessionId });
});

app.post("/logout", (request, response) => {
  const { sessionId } = request.body;

  if (!sessionId || !request.session.user || request.session.user.sessionId !== sessionId) {
    return response.status(404).json({ message: "No se encontró una sesión activa." });
  }

  request.session.destroy((err) => {
    if (err) {
      return response.status(500).send('Error al cerrar la sesión');
    }

    // Elimina la sesión del objeto sessions
    delete sessions[sessionId];

    console.log('Sesión cerrada:', sessionId); // Verificar si la sesión se elimina correctamente

    return response.status(200).json({ message: "Sesión cerrada correctamente." });
  });
});

app.put('/update', (request, response) => {
  if (!request.session.user) {
    return response.status(401).json({ message: "No estás autenticado. Inicia sesión primero." });
  }

  const { nickname, email, macAddress } = request.body;

  if (!nickname && !email && !macAddress) {
    return response.status(400).json({ message: "Se deben proporcionar al menos uno de los campos: nickname, email, macAddress." });
  }

  if (nickname) request.session.user.nickname = nickname;
  if (email) request.session.user.email = email;
  if (macAddress) request.session.user.macAddress = macAddress;

  request.session.user.lastAccessed = new Date();

  // Actualiza la sesión en el objeto sessions
  sessions[request.session.user.sessionId] = request.session.user;

  console.log('Sesión actualizada:', sessions[request.session.user.sessionId]); // Verificar si la sesión se actualiza correctamente

  return response.status(200).json({
    message: "Datos actualizados correctamente.",
    updatedUser: request.session.user
  });
});

app.get("/status", (request, response) => {
  const sessionId = request.query.sessionId;

  console.log('Consultando estado de la sesión:', sessionId); // Verificar la consulta del estado de la sesión

  if (!sessionId || !sessions[sessionId]) {
    return response.status(404).json({ message: "No se encontró una sesión activa con el sessionId proporcionado." });
  }
  const sessionData = sessions[sessionId];
  return response.status(200).json({
    message: "Sesión activa.",
    sessionDetails: sessionData
  });
});

app.get('/listCurrentSession', (req, res) => {
  const { sessionId } = req.query; // Asegúrate de usar 'sessionId'
  const now = new Date();

  console.log('Listando sesión actual:', sessionId); // Verificar la consulta de la sesión actual

  // Verifica si la sesión existe
  if (!sessionId || !sessions[sessionId]) {
    return res.status(404).json({ message: "No hay una sesión activa" });
  }

  const sessionData = sessions[sessionId];

  // Recupera los datos de la sesión
  const started = new Date(sessionData.createdAt);
  const lastUpdate = new Date(sessionData.lastAccessed);
  const nickname = sessionData.nickname || "Desconocido";
  const email = sessionData.email || "No proporcionado";
  const ipSolicitud = sessionData.ip || "No registrada";

  // Verifica que las fechas sean válidas
  if (isNaN(started.getTime()) || isNaN(lastUpdate.getTime())) {
    return res.status(400).json({ message: "Las fechas de la sesión no son válidas" });
  }

  // Calcular la antigüedad de la sesión
  const sessionAgeMS = now - started;
  const hours = Math.floor(sessionAgeMS / (1000 * 60 * 60));
  const minutes = Math.floor((sessionAgeMS % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((sessionAgeMS % (1000 * 60)) / 1000);

  const createAD_CDMX = moment(started).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');
  const lastAccess = moment(lastUpdate).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');

  // Respuesta con el estado de la sesión
  res.status(200).json({
    message: 'Estado de la sesión',
    nickname: nickname,
    sessionID: sessionId, // Mostrar 'sessionId' correctamente
    email: email,
    ipSolicitud: ipSolicitud,
    ipRespuesta: getLocalIP(),
    inicio: createAD_CDMX,
    ultimoAcceso: lastAccess,
    antigüedad: `${hours} horas, ${minutes} minutos y ${seconds} segundos`
  });
});

function getLocalIp() {
  // Implementa esta función para obtener la IP local según tu entorno

  return ' 192.168.1.64';
}
