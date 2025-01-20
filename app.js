import express, { request, response } from 'express';
import session from 'express-session'; 
import bodyParser from 'body-parser';  
import { v4 as uuidv4 } from 'uuid';
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
    return response.status(200).json({
      message: "Datos actualizados correctamente.",
      updatedUser: request.session.user
    });
  });
  
  
  const sessions = {};  
app.get("/status", (request, response) => {
  const sessionId = request.query.sessionId;

  
  if (!sessionId || !sessions[sessionId]) {
    return response.status(404).json({ message: "No se encontró una sesión activa con el sessionId proporcionado." });
  }
  const sessionData = sessions[sessionId];
  return response.status(200).json({
    message: "Sesión activa.",
    sessionDetails: sessionData
  });
});

   
 
  