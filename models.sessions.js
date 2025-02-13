import { model, Schema } from "mongoose";

const SessionsSchema = new Schema({
    sessionId: {
        unique: true,
        require: true,
        type: String
    },
    nickname: String,
    email: String,
    macAddress: String,
    status: String,
    clientIP: String,    // Nuevo campo para IP del cliente
    serverIP: String,    // Nuevo campo para IP del servidor
    timestamp: { type: Date, default: Date.now },
    lastAccessed: { type: Date, default: Date.now }
}, {
    versionKey: false,
    timestamps: true
});

export default model("Session", SessionsSchema);