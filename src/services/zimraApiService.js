const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ZIMRA_API_URL, ZIMRA_API_KEY } = require('../config/zimra');

class ZimraApiService {
  constructor(device) {
    this.device = device;
    this.axiosInstance = axios.create({
      baseURL: ZIMRA_API_URL,
      headers: {
        'DeviceModelName': device.modelName,
        'DeviceModelVersion': device.modelVersion,
        'Content-Type': 'application/json'
      }
    });
  }

  async registerDevice(activationKey, csr) {
    try {
      const response = await this.axiosInstance.post('/registerDevice', {
        deviceID: this.device.deviceId,
        activationKey,
        certificateRequest: csr
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async submitReceipt(receiptData) {
    try {
      const response = await this.axiosInstance.post('/submitReceipt', {
        deviceID: this.device.deviceId,
        receipt: receiptData
      }, {
        httpsAgent: this.getHttpsAgent()
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async openFiscalDay(fiscalDayNo, openedAt) {
    try {
      const response = await this.axiosInstance.post('/openDay', {
        deviceID: this.device.deviceId,
        fiscalDayNo,
        fiscalDayOpened: openedAt
      }, {
        httpsAgent: this.getHttpsAgent()
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async closeFiscalDay(fiscalDayNo, counters, signature) {
    try {
      const response = await this.axiosInstance.post('/closeDay', {
        deviceID: this.device.deviceId,
        fiscalDayNo,
        fiscalDayCounters: counters,
        fiscalDayDeviceSignature: signature,
        receiptCounter: this.device.lastReceiptGlobalNo
      }, {
        httpsAgent: this.getHttpsAgent()
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ... (previous code)

  async getFileStatus(operationId, fiscalDayNo) {
    try {
      const response = await this.axiosInstance.post('/getFileStatus', {
        deviceID: this.device.deviceId,
        operationId,
        fiscalDayNo
      }, {
        httpsAgent: this.getHttpsAgent()
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getConfig() {
    try {
      const response = await this.axiosInstance.post('/getConfig', {
        deviceID: this.device.deviceId
      }, {
        httpsAgent: this.getHttpsAgent()
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async ping() {
    try {
      const response = await this.axiosInstance.post('/ping', {
        deviceID: this.device.deviceId
      }, {
        httpsAgent: this.getHttpsAgent()
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async issueCertificate(csr) {
    try {
      const response = await this.axiosInstance.post('/issueCertificate', {
        deviceID: this.device.deviceId,
        certificateRequest: csr
      }, {
        httpsAgent: this.getHttpsAgent()
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  getHttpsAgent() {
    // Implement HTTPS agent with device certificate
    // This is a simplified version - actual implementation needs proper cert handling
    return new (require('https').Agent)({
      rejectUnauthorized: true,
      cert: this.device.certificate,
      key: this.device.privateKey // In real app, this should be securely stored
    });
  }

  handleError(error) {
    if (error.response) {
      return new Error(`ZIMRA API Error: ${error.response.data.errorCode} - ${error.response.data.message}`);
    } else if (error.request) {
      return new Error('No response received from ZIMRA API');
    } else {
      return new Error(`Error setting up ZIMRA API request: ${error.message}`);
    }
  }
}

module.exports = ZimraApiService;