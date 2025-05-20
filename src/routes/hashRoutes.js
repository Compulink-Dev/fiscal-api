// routes/hash.js
const crypto = require('crypto');

async function hashHandler(req, res) {
    try {
        await mongoose.connection; // Ensure DB connection

        // Fetch metadata from the database
        let metadata = await Tracking.findOne();
        if (!metadata) {
            metadata = new Tracking({
                fiscalCounters: {},
                previousHash: '',
                lastReceiptGlobalNo: 104,
                lastReceiptCounter: 22,
                previousReceiptDate: '2024-11-13T19:18:00',
            });
            await metadata.save();
        }

        const { fiscalCounters, previousHash, lastReceiptGlobalNo, lastReceiptCounter, previousReceiptDate } = metadata;

        const generateFiscalDayHash = (data) => {
            const baseString = `${data.deviceID}${data.fiscalDayNo}${data.fiscalDayDate}`;
            
            const processedCounters = data.fiscalDayCounters
                .filter(counter => counter.fiscalCounterValue !== 0)
                .map(counter => {
                    let taxOrMoneyType = "";
                    if (counter.fiscalCounterTaxPercent !== undefined && counter.fiscalCounterTaxPercent !== null) {
                        taxOrMoneyType = counter.fiscalCounterTaxPercent % 1 === 0
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
                { fiscalCounterType: "SaleByTax", fiscalCounterCurrency: "ZWL", fiscalCounterTaxPercent: 0, fiscalCounterValue: 23000.0 },
                { fiscalCounterType: "SaleByTax", fiscalCounterCurrency: "USD", fiscalCounterTaxPercent: 14.5, fiscalCounterValue: 25.0 },
                { fiscalCounterType: "BalanceByMoneyType", fiscalCounterCurrency: "ZWL", fiscalCounterMoneyType: "CASH", fiscalCounterValue: 20000.0 },
                { fiscalCounterType: "BalanceByMoneyType", fiscalCounterCurrency: "ZWL", fiscalCounterMoneyType: "CARD", fiscalCounterValue: 15000.0 },
                { fiscalCounterType: "SaleTaxByTax", fiscalCounterCurrency: "USD", fiscalCounterTaxPercent: 15.0, fiscalCounterValue: 2.5 },
            ],
        };

        const hash = generateFiscalDayHash(fiscalDayData);
        console.log("Fiscal Day Hash:", hash);

        const receiptGlobalNo = lastReceiptGlobalNo + 1;
        const receiptCounter = lastReceiptCounter + 1;
        const payload = req.body;

        console.log('Received payload in /api/hash:', payload);

        payload.receiptGlobalNo = receiptGlobalNo;
        console.log('Updated receiptGlobalNo:', payload.receiptGlobalNo);

        payload.receiptCounter = receiptCounter;
        console.log('Updated receiptCounter:', payload.receiptCounter);

        const updatedCounters = { ...fiscalCounters };

        payload.receiptTaxes.forEach(tax => {
            const taxID = tax.taxID.toString();
            const taxPercent = tax.taxPercent ? tax.taxPercent.toFixed(2) : '0.00';
            const currency = payload.receiptCurrency;

            console.log("Tax ID:", taxID);

            if (payload.receiptType === 'FiscalInvoice') {
                updatedCounters[`SaleByTax-${currency}-${taxPercent}`] =
                    (updatedCounters[`SaleByTax-${currency}-${taxPercent}`] || 0) +
                    Math.round(tax.salesAmountWithTax * 100);
                updatedCounters[`SaleTaxByTax-${currency}-${taxPercent}`] =
                    (updatedCounters[`SaleTaxByTax-${currency}-${taxPercent}`] || 0) +
                    Math.round(tax.taxAmount * 100);
            }

            if (payload.receiptType === 'CreditNote') {
                updatedCounters[`CreditNoteByTax-${currency}-${taxPercent}`] =
                    (updatedCounters[`CreditNoteByTax-${currency}-${taxPercent}`] || 0) -
                    Math.round(tax.salesAmountWithTax * 100);
                updatedCounters[`CreditNoteTaxByTax-${currency}-${taxPercent}`] =
                    (updatedCounters[`CreditNoteTaxByTax-${currency}-${taxPercent}`] || 0) -
                    Math.round(tax.taxAmount * 100);
            }

            if (payload.receiptType === 'DebitNote') {
                updatedCounters[`DebitNoteByTax-${currency}-${taxPercent}`] =
                    (updatedCounters[`DebitNoteByTax-${currency}-${taxPercent}`] || 0) +
                    Math.round(tax.salesAmountWithTax * 100);
                updatedCounters[`DebitNoteTaxByTax-${currency}-${taxPercent}`] =
                    (updatedCounters[`DebitNoteTaxByTax-${currency}-${taxPercent}`] || 0) +
                    Math.round(tax.taxAmount * 100);
            }
        });

        const receiptTotalInCents = Math.round(Number(payload.receiptTotal) * 100);
        if (isNaN(receiptTotalInCents)) {
            return res.status(400).json({
                error: 'Invalid receiptTotal: Must be a valid number'
            });
        }

        const paymentKey = `BalanceByMoneyType-${payload.paymentMethod}-${payload.receiptCurrency}`;
        updatedCounters[paymentKey] = (updatedCounters[paymentKey] || 0) + receiptTotalInCents;

        const nonZeroCounters = Object.entries(updatedCounters)
            .filter(([_, value]) => value !== 0)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

        const fiscalCountersString = nonZeroCounters
            .map(([key, value]) => `${key.toUpperCase()}${value}`)
            .join('');

        const requiredFields = [
            'deviceID',
            'receiptType',
            'receiptCurrency',
            'receiptGlobalNo',
            'receiptDate',
            'receiptTotal',
            'receiptTaxes',
        ];
        const missingFields = requiredFields.filter(field => !(field in payload));

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: `Invalid payload: Missing fields (${missingFields.join(', ')})`
            });
        }

        if (!Array.isArray(payload.receiptTaxes) || payload.receiptTaxes.length === 0) {
            return res.status(400).json({
                error: 'Invalid receiptTaxes: Must be a non-empty array'
            });
        }

        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey || !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
            console.error('Invalid private key configuration.');
            return res.status(500).json({
                error: 'Server configuration error: Invalid private key'
            });
        }

        const receiptDate = new Date(payload.receiptDate);
        if (isNaN(receiptDate.getTime())) {
            return res.status(400).json({
                error: 'Invalid receiptDate: Must be a valid ISO date'
            });
        }

        const formatToISO8601 = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        };

        const formattedDate = formatToISO8601(receiptDate);
        const previousDate = new Date(previousReceiptDate);

        console.log('Formatted Date:', formattedDate);
        console.log('Previous Receipt Date:', previousReceiptDate);

        if (receiptDate <= previousDate) {
            return res.status(400).json({
                error: `Invalid receiptDate: Must be older than the previous receipt date (${receiptDate})`
            });
        }

        const formattedTaxes = payload.receiptTaxes.map((tax, index) => {
            if (
                typeof tax.taxID !== 'number' ||
                typeof tax.taxAmount !== 'number' ||
                typeof tax.salesAmountWithTax !== 'number'
            ) {
                throw new Error(`Invalid tax fields at index ${index}: taxID, taxAmount, and salesAmountWithTax must be numbers`);
            }

            const taxPercent = tax.taxPercent != null ? tax.taxPercent.toFixed(2) : '';
            const taxAmount = Math.round(tax.taxAmount * 100);
            const salesAmountWithTax = Math.round(tax.salesAmountWithTax * 100);

            return `${tax.taxID}${taxPercent}${taxAmount}${salesAmountWithTax}`;
        });

        const currentPreviousHash = previousHash || '9c461d087d1fc8c50672fbfe16b93355';
        console.log('Current Previous Hash:', currentPreviousHash);

        const dayConcatenatedString = `${payload.deviceID}${payload.receiptType}${payload.receiptCurrency}${receiptGlobalNo}${payload.receiptDate}${receiptTotalInCents}${fiscalCountersString}${previousHash || '0000'}`;
        const dayMd5DataHash = crypto.createHash('md5').update(dayConcatenatedString, 'utf8').digest('hex');

        console.log("Day MD5:", dayMd5DataHash);

        const concatenatedString = `${payload.deviceID}${payload.receiptType}${payload.receiptCurrency}${receiptGlobalNo}${formattedDate}${receiptTotalInCents}${formattedTaxes.join('')}${currentPreviousHash}`;
        console.log('Concatenated String for MD5 Hashing:', concatenatedString);

        const md5DataHash = crypto.createHash('md5').update(concatenatedString, 'utf8').digest('hex');
        console.log('MD5 Hash:', md5DataHash);

        let signature;
        try {
            const bufferToSign = Buffer.from(md5DataHash, 'hex');
            const encryptedBuffer = crypto.privateEncrypt(
                {
                    key: privateKey,
                    padding: crypto.constants.RSA_PKCS1_PADDING,
                },
                bufferToSign
            );

            signature = encryptedBuffer.toString('base64');
        } catch (error) {
            console.error('Error signing hash:', error);
            return res.status(500).json({
                error: 'Failed to sign data',
                details: error.message
            });
        }

        metadata.previousHash = md5DataHash;
        metadata.lastReceiptGlobalNo = receiptGlobalNo;
        metadata.lastReceiptCounter = receiptCounter;
        metadata.previousReceiptDate = formattedDate;
        await metadata.save();

        console.log('Updated metadata:', {
            previousHash: metadata.previousHash,
            lastReceiptGlobalNo: metadata.lastReceiptGlobalNo,
            receiptCounter: metadata.lastReceiptCounter,
            previousReceiptDate: metadata.previousReceiptDate,
        });

        const binarySignature = Buffer.from(signature, 'base64');
        const md5SignatureHash = crypto.createHash('md5').update(binarySignature).digest('hex');
        const first16Chars = md5SignatureHash.substring(0, 16);

        res.json({
            receiptGlobalNo,
            receiptCounter,
            receiptDeviceSignature: {
                hash: md5DataHash,
                signature,
            },
            binarySignature: binarySignature.toString('hex'),
            md5Hash: md5SignatureHash,
            receiptQrData16: first16Chars,
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({
            error: 'Unexpected server error',
            details: error.message
        });
    }
}

module.exports = hashHandler;