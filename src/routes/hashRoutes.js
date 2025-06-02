// routes/hash.js
const crypto = require("crypto");
const mongoose = require("mongoose"); // Add this import
const Tracking = require("../models/Tracking"); // Make sure to import your Tracking model
const connectDB = require("../config/db"); // Import your DB connection

async function hashHandler(req, res) {
  try {
    // Connect to MongoDB
    await connectDB();

    await mongoose.connection; // Ensure DB connection

    // Fetch metadata from the database
    let metadata = await Tracking.findOne();
    if (!metadata) {
      metadata = new Tracking({
        fiscalCounters: {},
        previousHash: "",
        lastReceiptGlobalNo: 104,
        lastReceiptCounter: 22,
        previousReceiptDate: "2024-11-13T19:18:00",
      });
      await metadata.save();
    }

    const {
      fiscalCounters,
      previousHash,
      lastReceiptGlobalNo,
      lastReceiptCounter,
      previousReceiptDate,
    } = metadata;

    const generateFiscalDayHash = (data) => {
      const baseString = `${data.deviceID}${data.fiscalDayNo}${data.fiscalDayDate}`;

      const processedCounters = data.fiscalDayCounters
        .filter((counter) => counter.fiscalCounterValue !== 0)
        .map((counter) => {
          let taxOrMoneyType = "";
          if (
            counter.fiscalCounterTaxPercent !== undefined &&
            counter.fiscalCounterTaxPercent !== null
          ) {
            taxOrMoneyType =
              counter.fiscalCounterTaxPercent % 1 === 0
                ? `${counter.fiscalCounterTaxPercent.toFixed(2)}`
                : `${counter.fiscalCounterTaxPercent.toFixed(2)}`;
          } else if (counter.fiscalCounterMoneyType) {
            taxOrMoneyType = counter.fiscalCounterMoneyType.toUpperCase();
          }

          const valueInCents = Math.round(counter.fiscalCounterValue * 100);
          return `${counter.fiscalCounterType.toUpperCase()}${counter.fiscalCounterCurrency.toUpperCase()}${taxOrMoneyType}${valueInCents}`;
        });

      const sortedCounters = processedCounters.sort();
      const finalString = `${baseString}${sortedCounters.join("")}`;
      return crypto.createHash("sha256").update(finalString).digest("hex");
    };

    const fiscalDayData = {
      deviceID: "321",
      fiscalDayNo: 84,
      fiscalDayDate: "2019-09-23",
      fiscalDayCounters: [
        {
          fiscalCounterType: "SaleByTax",
          fiscalCounterCurrency: "ZWL",
          fiscalCounterTaxPercent: 0,
          fiscalCounterValue: 23000.0,
        },
        {
          fiscalCounterType: "SaleByTax",
          fiscalCounterCurrency: "USD",
          fiscalCounterTaxPercent: 14.5,
          fiscalCounterValue: 25.0,
        },
        {
          fiscalCounterType: "BalanceByMoneyType",
          fiscalCounterCurrency: "ZWL",
          fiscalCounterMoneyType: "CASH",
          fiscalCounterValue: 20000.0,
        },
        {
          fiscalCounterType: "BalanceByMoneyType",
          fiscalCounterCurrency: "ZWL",
          fiscalCounterMoneyType: "CARD",
          fiscalCounterValue: 15000.0,
        },
        {
          fiscalCounterType: "SaleTaxByTax",
          fiscalCounterCurrency: "USD",
          fiscalCounterTaxPercent: 15.0,
          fiscalCounterValue: 2.5,
        },
      ],
    };

    const hash = generateFiscalDayHash(fiscalDayData);
    console.log("Fiscal Day Hash:", hash);

    const receiptGlobalNo = lastReceiptGlobalNo + 1;
    const receiptCounter = lastReceiptCounter + 1;
    // Extract privateKey from request body
    const { privateKey, ...payload } = req.body;

    if (!privateKey) {
      return res.status(400).json({
        error: "PRIVATE_KEY is required in the request body",
      });
    }

    // Validate private key format
    if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
      return res.status(400).json({
        error: "Invalid private key format",
      });
    }

    console.log("Received payload in /api/hash:", payload);

    payload.receipt.receiptGlobalNo = receiptGlobalNo;
    console.log("Updated receiptGlobalNo:", payload.receipt.receiptGlobalNo);

    payload.receipt.receiptCounter = receiptCounter;
    console.log("Updated receiptCounter:", payload.receipt.receiptCounter);

    console.log("receiptTotal details:", {
      value: payload.receipt.receiptTotal,
      type: typeof payload.receipt.receiptTotal,
      isNumber: typeof payload.receipt.receiptTotal === "number",
      isString: typeof payload.receipt.receiptTotal === "string",
      parsedFloat: parseFloat(payload.receipt.receiptTotal),
      isNaN: isNaN(payload.receipt.receiptTotal),
    });

    const updatedCounters = { ...fiscalCounters };

    payload.receipt.receiptTaxes.forEach((tax) => {
      const taxID = tax.taxID.toString();
      const taxPercent = tax.taxPercent ? tax.taxPercent.toFixed(2) : "0.00";
      const currency = payload.receipt.receiptCurrency;

      console.log("Tax ID:", taxID);

      if (payload.receipt.receiptType === "FISCALINVOICE") {
        updatedCounters[`SaleByTax-${currency}-${taxPercent}`] =
          (updatedCounters[`SaleByTax-${currency}-${taxPercent}`] || 0) +
          Math.round(tax.salesAmountWithTax * 100);
        updatedCounters[`SaleTaxByTax-${currency}-${taxPercent}`] =
          (updatedCounters[`SaleTaxByTax-${currency}-${taxPercent}`] || 0) +
          Math.round(tax.taxAmount * 100);
      }

      if (payload.receipt.receiptType === "CREDITNOTE") {
        updatedCounters[`CreditNoteByTax-${currency}-${taxPercent}`] =
          (updatedCounters[`CreditNoteByTax-${currency}-${taxPercent}`] || 0) -
          Math.round(tax.salesAmountWithTax * 100);
        updatedCounters[`CreditNoteTaxByTax-${currency}-${taxPercent}`] =
          (updatedCounters[`CreditNoteTaxByTax-${currency}-${taxPercent}`] ||
            0) - Math.round(tax.taxAmount * 100);
      }

      if (payload.receipt.receiptType === "DEBITNOTE") {
        updatedCounters[`DebitNoteByTax-${currency}-${taxPercent}`] =
          (updatedCounters[`DebitNoteByTax-${currency}-${taxPercent}`] || 0) +
          Math.round(tax.salesAmountWithTax * 100);
        updatedCounters[`DebitNoteTaxByTax-${currency}-${taxPercent}`] =
          (updatedCounters[`DebitNoteTaxByTax-${currency}-${taxPercent}`] ||
            0) + Math.round(tax.taxAmount * 100);
      }
    });

    // With this more robust version:
    let receiptTotalInCents;
    try {
      // Convert to number if it's a string
      const totalValue =
        typeof payload.receipt.receiptTotal === "string"
          ? parseFloat(payload.receipt.receiptTotal)
          : Number(payload.receipt.receiptTotal);

      if (isNaN(totalValue) || !isFinite(totalValue)) {
        throw new Error("Invalid receiptTotal value");
      }

      receiptTotalInCents = Math.round(totalValue * 100);
      console.log("Processed receiptTotal:", {
        original: payload.receipt.receiptTotal,
        type: typeof payload.receipt.receiptTotal,
        converted: totalValue,
        inCents: receiptTotalInCents,
      });
    } catch (error) {
      return res.status(400).json({
        error: "Invalid receiptTotal: " + error.message,
        receivedValue: payload.receipt.receiptTotal,
        receivedType: typeof payload.receipt.receiptTotal,
      });
    }

    const paymentMethod =
      payload.receipt.receiptPayments?.[0]?.moneyTypeCode || "CASH";
    const paymentKey = `BalanceByMoneyType-${paymentMethod}-${payload.receipt.receiptCurrency}`;
    updatedCounters[paymentKey] =
      (updatedCounters[paymentKey] || 0) + receiptTotalInCents;

    const nonZeroCounters = Object.entries(updatedCounters)
      .filter(([_, value]) => value !== 0)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

    const fiscalCountersString = nonZeroCounters
      .map(([key, value]) => `${key.toUpperCase()}${value}`)
      .join("");

    const requiredFields = [
      "deviceID",
      "receipt", // Ensure receipt object exists
    ];

    const requiredReceiptFields = [
      "receiptType",
      "receiptCurrency",
      "receiptGlobalNo",
      "receiptDate",
      "receiptTotal",
      "receiptTaxes",
    ];

    // Check for receipt object
    if (!payload.receipt) {
      return res.status(400).json({
        error: "Invalid payload: Missing receipt object",
      });
    }

    // Check for required receipt fields
    const missingReceiptFields = requiredReceiptFields.filter(
      (field) => !(field in payload.receipt)
    );

    if (missingReceiptFields.length > 0) {
      return res.status(400).json({
        error: `Invalid payload: Missing fields in receipt (${missingReceiptFields.join(
          ", "
        )})`,
      });
    }
    if (
      !Array.isArray(payload.receipt.receiptTaxes) ||
      payload.receipt.receiptTaxes.length === 0
    ) {
      return res.status(400).json({
        error: "Invalid receiptTaxes: Must be a non-empty array",
      });
    }

    if (!privateKey || !privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
      console.error("Invalid private key configuration.");
      return res.status(500).json({
        error: "Server configuration error: Invalid private key",
      });
    }

    const receiptDate = new Date(payload.receipt.receiptDate);
    if (isNaN(receiptDate.getTime())) {
      return res.status(400).json({
        error: "Invalid receiptDate: Must be a valid ISO date",
      });
    }

    const formatToISO8601 = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };

    const formattedDate = formatToISO8601(receiptDate);
    const previousDate = new Date(previousReceiptDate);

    console.log("Formatted Date:", formattedDate);
    console.log("Previous Receipt Date:", previousReceiptDate);

    if (receiptDate <= previousDate) {
      return res.status(400).json({
        error: `Invalid receiptDate: Must be older than the previous receipt date (${receiptDate})`,
      });
    }

    const formattedTaxes = payload.receipt.receiptTaxes.map((tax, index) => {
      if (
        typeof tax.taxID !== "number" ||
        typeof tax.taxAmount !== "number" ||
        typeof tax.salesAmountWithTax !== "number"
      ) {
        throw new Error(
          `Invalid tax fields at index ${index}: taxID, taxAmount, and salesAmountWithTax must be numbers`
        );
      }

      const taxPercent =
        tax.taxPercent != null ? tax.taxPercent.toFixed(2) : "";
      const taxAmount = Math.round(tax.taxAmount * 100);
      const salesAmountWithTax = Math.round(tax.salesAmountWithTax * 100);

      return `${tax.taxID}${taxPercent}${taxAmount}${salesAmountWithTax}`;
    });

    const currentPreviousHash =
      previousHash || "9c461d087d1fc8c50672fbfe16b93355";
    console.log("Current Previous Hash:", currentPreviousHash);

    const dayConcatenatedString = `${payload.deviceID}${
      payload.receipt.receiptType
    }${payload.receipt.receiptCurrency}${receiptGlobalNo}${
      payload.receipt.receiptDate
    }${receiptTotalInCents}${fiscalCountersString}${previousHash || "0000"}`;
    const dayMd5DataHash = crypto
      .createHash("md5")
      .update(dayConcatenatedString, "utf8")
      .digest("hex");

    console.log("Day MD5:", dayMd5DataHash);

    const concatenatedString = `${payload.deviceID}${
      payload.receipt.receiptType
    }${
      payload.receipt.receiptCurrency
    }${receiptGlobalNo}${formattedDate}${receiptTotalInCents}${formattedTaxes.join(
      ""
    )}${currentPreviousHash}`;
    console.log("Concatenated String for MD5 Hashing:", concatenatedString);

    const md5DataHash = crypto
      .createHash("md5")
      .update(concatenatedString, "utf8")
      .digest("hex");
    console.log("MD5 Hash:", md5DataHash);

    let signature;
    try {
      const bufferToSign = Buffer.from(md5DataHash, "hex");
      const encryptedBuffer = crypto.privateEncrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        bufferToSign
      );

      signature = encryptedBuffer.toString("base64");
    } catch (error) {
      console.error("Error signing hash:", error);
      return res.status(500).json({
        error: "Failed to sign data",
        details: error.message,
      });
    }

    metadata.previousHash = md5DataHash;
    metadata.lastReceiptGlobalNo = receiptGlobalNo;
    metadata.lastReceiptCounter = receiptCounter;
    metadata.previousReceiptDate = formattedDate;
    await metadata.save();

    console.log("Updated metadata:", {
      previousHash: metadata.previousHash,
      lastReceiptGlobalNo: metadata.lastReceiptGlobalNo,
      receiptCounter: metadata.lastReceiptCounter,
      previousReceiptDate: metadata.previousReceiptDate,
    });

    const binarySignature = Buffer.from(signature, "base64");
    const md5SignatureHash = crypto
      .createHash("md5")
      .update(binarySignature)
      .digest("hex");
    const first16Chars = md5SignatureHash.substring(0, 16);

    res.json({
      receiptGlobalNo,
      receiptCounter,
      receiptDeviceSignature: {
        hash: md5DataHash,
        signature,
      },
      binarySignature: binarySignature.toString("hex"),
      md5Hash: md5SignatureHash,
      receiptQrData16: first16Chars,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      error: "Unexpected server error",
      details: error.message,
    });
  }
}

module.exports = hashHandler;
