import { model, Schema } from "mongoose";

const SessionsSchema = new Schema({
  sessionId: {
        unique: true,
        required: true,
        type: String
    },
    clientData: {
        ip: String,
        macAddress: String
    },
    serverData: {
        ip: String,
        macAddress: String
    },
    status: String,
    nickname: String,
    email: String,
    timestamp: { type: Date, default: Date.now },
    lastAccessed: { type: Date, default: Date.now },
    inactive: { type: Number, default: 0 }, // Tiempo en segundos
    duration: { type: Number, default: 0 }  // Duración en segundos
}, {
    versionKey: false,
    timestamps: true
});

export default model("Session", SessionsSchema);