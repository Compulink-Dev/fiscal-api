const crypto = require('crypto');
const forge = require('node-forge');

// Generate certificate from CSR
exports.generateCertificate = async (csrPem) => {
  try {
    // Parse CSR
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    
    // Validate CSR subject
    const subject = csr.subject.getField('CN');
    if (!subject.value.startsWith('ZIMRA-')) {
      throw new Error('Invalid CSR subject');
    }

    // Create certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = csr.publicKey;
    cert.serialNumber = crypto.randomBytes(4).toString('hex');
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1); // 1 year validity
    
    // Set subject and issuer
    cert.setSubject(csr.subject.attributes);
    cert.setIssuer([{
      name: 'commonName',
      value: 'ZIMRA FDMS Root CA'
    }, {
      name: 'organizationName',
      value: 'Zimbabwe Revenue Authority'
    }, {
      name: 'countryName',
      value: 'ZW'
    }]);

    // Set extensions
    cert.setExtensions([{
      name: 'basicConstraints',
      cA: false
    }, {
      name: 'keyUsage',
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true
    }, {
      name: 'extKeyUsage',
      serverAuth: false,
      clientAuth: true
    }]);

    // Sign certificate with CA private key (in production, use your CA key)
    const caKey = forge.pki.privateKeyFromPem(process.env.CA_PRIVATE_KEY);
    cert.sign(caKey, forge.md.sha256.create());

    // Convert to PEM
    const certPem = forge.pki.certificateToPem(cert);

    return {
      certificate: certPem,
      validTill: cert.validity.notAfter
    };

  } catch (err) {
    throw new Error('Certificate generation failed: ' + err.message);
  }
};

// Get server certificate
exports.getServerCertificate = async (thumbprint) => {
  // In production, this would fetch the certificate from a secure store
  const serverCert = process.env.SERVER_CERTIFICATE;
  const caCert = process.env.CA_CERTIFICATE;
  
  return {
    certificate: [serverCert, caCert],
    certificateValidTill: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
  };
};