import NodeRSA from 'node-rsa';
import fs from 'fs';
import path from 'path';

class EncryptionService {
    constructor() {
        this.key = null;
        this.KEY_PATH = path.join(process.cwd(), 'private_key.pem');
        this.initializeRSAKey();
    }

    initializeRSAKey() {
        try {
            if (fs.existsSync(this.KEY_PATH)) {
                const privateKeyData = fs.readFileSync(this.KEY_PATH, 'utf8');
                this.key = new NodeRSA(privateKeyData);
                console.log('Clave RSA cargada exitosamente');
            } else {
                this.key = new NodeRSA({ b: 512 });
                const privateKeyData = this.key.exportKey('private');
                fs.writeFileSync(this.KEY_PATH, privateKeyData);
                console.log('Nueva clave RSA generada y guardada');
            }
        } catch (error) {
            console.error('Error al inicializar la clave RSA:', error);
            throw error;
        }
    }

    encrypt(data) {
        try {
            return this.key.encrypt(data, 'base64');
        } catch (error) {
            console.error('Error al encriptar datos:', error);
            throw error;
        }
    }

    decrypt(data) {
        try {
            return this.key.decrypt(data, 'utf8');
        } catch (error) {
            console.error('Error al desencriptar datos:', error);
            throw error;
        }
    }

    encryptSessionData({ email, nickname, macAddress, clientIP, serverIP }) {
        return {
            email: this.encrypt(email),
            nickname: this.encrypt(nickname),
            macAddress: this.encrypt(macAddress),
            clientIP: this.encrypt(clientIP),
            serverIP: this.encrypt(serverIP)
        };
    }

    decryptSessionData(session) {
        try {
            return {
                ...session,
                email: session.email ? this.decrypt(session.email) : 'No disponible',
                nickname: session.nickname ? this.decrypt(session.nickname) : 'No disponible',
                macAddress: session.macAddress ? this.decrypt(session.macAddress) : 'No disponible',
                clientIP: session.clientIP ? this.decrypt(session.clientIP) : 'No disponible',
                serverIP: session.serverIP ? this.decrypt(session.serverIP) : 'No disponible'
            };
        } catch (error) {
            console.error(`Error al desencriptar sesión:`, error);
            return {
                sessionId: session.sessionId,
                status: session.status,
                error: 'Error al desencriptar datos de la sesión'
            };
        }
    }
}

export const encryptionService = new EncryptionService();