const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

module.exports = {
  encryptData: (data, key) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  },

  decryptData: (data, key) => {
    const parts = data.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  },

  generateDeviceActivationKey: () => {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  },

  storeCertificate: (deviceId, certificate) => {
    const certPath = path.join(__dirname, '../certs', `${deviceId}.pem`);
    fs.writeFileSync(certPath, certificate);
    return certPath;
  },

  loadCertificate: (deviceId) => {
    const certPath = path.join(__dirname, '../certs', `${deviceId}.pem`);
    return fs.readFileSync(certPath, 'utf8');
  }
};