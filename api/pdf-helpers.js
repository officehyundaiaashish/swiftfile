// --- PDF Encryption Engine (Lightweight Standard Security Handler) ---
const PDFEncryption = (() => {
    const PADDING = new Uint8Array([
        0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
        0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A
    ]);

    function md5(data) {
        const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
        const K = new Uint32Array([0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391]);
        let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
        const msgLen = bytes.length, msgBitLen = msgLen * 8, msgLenPadded = ((msgLen + 9 + 63) & ~63), msg = new Uint8Array(msgLenPadded);
        msg.set(bytes); msg[msgLen] = 0x80;
        const dataView = new DataView(msg.buffer); dataView.setUint32(msgLenPadded - 8, msgBitLen, true);
        for (let offset = 0; offset < msgLenPadded; offset += 64) {
            const chunk = new Uint32Array(msg.buffer, offset, 16);
            let a = a0, b = b0, c = c0, d = d0;
            for (let i = 0; i < 64; i++) {
                let f, g;
                if (i < 16) { f = (b & c) | ((~b) & d); g = i; }
                else if (i < 32) { f = (d & b) | ((~d) & c); g = (5 * i + 1) % 16; }
                else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
                else { f = c ^ (b | (~d)); g = (7 * i) % 16; }
                f = (f + a + K[i] + chunk[g]) >>> 0;
                a = d; d = c; c = b; b = (b + ((f << S[i]) | (f >>> (32 - S[i])))) >>> 0;
            }
            a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
        }
        const result = new Uint8Array(16), rv = new DataView(result.buffer);
        rv.setUint32(0, a0, true); rv.setUint32(4, b0, true); rv.setUint32(8, c0, true); rv.setUint32(12, d0, true);
        return result;
    }

    class RC4 {
        constructor(key) {
            this.s = new Uint8Array(256); this.i = 0; this.j = 0;
            for (let i = 0; i < 256; i++) this.s[i] = i;
            let j = 0;
            for (let i = 0; i < 256; i++) {
                j = (j + this.s[i] + key[i % key.length]) & 0xFF;
                [this.s[i], this.s[j]] = [this.s[j], this.s[i]];
            }
        }
        process(data) {
            const result = new Uint8Array(data.length);
            for (let k = 0; k < data.length; k++) {
                this.i = (this.i + 1) & 0xFF; this.j = (this.j + this.s[this.i]) & 0xFF;
                [this.s[this.i], this.s[this.j]] = [this.s[this.j], this.s[this.i]];
                const t = (this.s[this.i] + this.s[this.j]) & 0xFF;
                result[k] = data[k] ^ this.s[t];
            }
            return result;
        }
    }

    const hexToBytes = hex => {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        return bytes;
    };
    const bytesToHex = bytes => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const padPassword = pwd => {
        const b = new TextEncoder().encode(pwd), p = new Uint8Array(32);
        if (b.length >= 32) p.set(b.slice(0, 32)); else { p.set(b); p.set(PADDING.slice(0, 32 - b.length), b.length); }
        return p;
    };

    function computeEncryptionKey(userPwd, ownerKey, p, id) {
        const pwd = padPassword(userPwd), input = new Uint8Array(pwd.length + ownerKey.length + 4 + id.length);
        let off = 0; input.set(pwd, off); off += pwd.length; input.set(ownerKey, off); off += ownerKey.length;
        input[off++] = p & 0xFF; input[off++] = (p >> 8) & 0xFF; input[off++] = (p >> 16) & 0xFF; input[off++] = (p >> 24) & 0xFF;
        input.set(id, off); let hash = md5(input);
        for (let i = 0; i < 50; i++) hash = md5(hash.slice(0, 16));
        return hash.slice(0, 16);
    }

    function computeOwnerKey(ownerPwd, userPwd) {
        const opwd = padPassword(ownerPwd || userPwd); let hash = md5(opwd);
        for (let i = 0; i < 50; i++) hash = md5(hash);
        const upwd = padPassword(userPwd); let res = new Uint8Array(upwd);
        for (let i = 0; i < 20; i++) {
            const key = new Uint8Array(hash.length); for (let j = 0; j < hash.length; j++) key[j] = hash[j] ^ i;
            res = new RC4(key.slice(0, 16)).process(res);
        }
        return res;
    }

    function computeUserKey(encKey, id) {
        const input = new Uint8Array(PADDING.length + id.length); input.set(PADDING); input.set(id, PADDING.length);
        let res = new RC4(encKey).process(md5(input));
        for (let i = 1; i <= 19; i++) {
            const key = new Uint8Array(encKey.length); for (let j = 0; j < encKey.length; j++) key[j] = encKey[j] ^ i;
            res = new RC4(key).process(res);
        }
        const final = new Uint8Array(32); final.set(res); return final;
    }

    function encryptObj(data, num, gen, key) {
        const k = new Uint8Array(key.length + 5); k.set(key);
        k[key.length] = num & 0xFF; k[key.length + 1] = (num >> 8) & 0xFF; k[key.length + 2] = (num >> 16) & 0xFF;
        k[key.length + 3] = gen & 0xFF; k[key.length + 4] = (gen >> 8) & 0xFF;
        const ok = md5(k); return new RC4(ok.slice(0, Math.min(key.length + 5, 16))).process(data);
    }

    function encryptStrings(obj, num, gen, key) {
        if (!obj) return;
        const { PDFString, PDFHexString, PDFDict, PDFArray } = PDFLib;
        if (obj instanceof PDFString) {
            obj.value = Array.from(encryptObj(obj.asBytes(), num, gen, key)).map(b => String.fromCharCode(b)).join('');
        } else if (obj instanceof PDFHexString) {
            obj.value = bytesToHex(encryptObj(obj.asBytes(), num, gen, key));
        } else if (obj instanceof PDFDict) {
            for (const [k, v] of obj.entries()) {
                const kn = k.asString();
                if (kn !== '/Length' && kn !== '/Filter' && kn !== '/DecodeParms') encryptStrings(v, num, gen, key);
            }
        } else if (obj instanceof PDFArray) {
            for (const e of obj.asArray()) encryptStrings(e, num, gen, key);
        }
    }

    return {
        async encrypt(pdfBytes, userPassword, ownerPassword = null) {
            const { PDFDocument, PDFName, PDFHexString, PDFNumber, PDFRawStream } = PDFLib;
            const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
            const context = pdfDoc.context;
            let fileId; const trailer = context.trailerInfo; const idArr = trailer.ID;
            if (idArr && Array.isArray(idArr) && idArr.length > 0) {
                fileId = hexToBytes(idArr[0].toString().replace(/^<|>$/g, ''));
            } else {
                fileId = crypto.getRandomValues(new Uint8Array(16));
                trailer.ID = [PDFHexString.of(bytesToHex(fileId)), PDFHexString.of(bytesToHex(fileId))];
            }
            const p = 0xFFFFFFFC, o = computeOwnerKey(ownerPassword, userPassword), ek = computeEncryptionKey(userPassword, o, p, fileId), u = computeUserKey(ek, fileId);
            for (const [ref, obj] of context.enumerateIndirectObjects()) {
                const num = ref.objectNumber, gen = ref.generationNumber || 0;
                if (obj instanceof PDFLib.PDFDict) {
                    const f = obj.get(PDFName.of('Filter'));
                    if (f && f.asString() === '/Standard') continue;
                }
                if (obj instanceof PDFRawStream && obj.dict) {
                    const t = obj.dict.get(PDFName.of('Type'));
                    if (t && (t.toString() === '/XRef' || t.toString() === '/Sig')) continue;
                }
                if (obj instanceof PDFRawStream) {
                    obj.contents = encryptObj(obj.contents, num, gen, ek);
                    if (obj.dict) encryptStrings(obj.dict, num, gen, ek);
                } else {
                    encryptStrings(obj, num, gen, ek);
                }
            }
            const encDict = context.obj({ Filter: PDFName.of('Standard'), V: PDFNumber.of(2), R: PDFNumber.of(3), Length: PDFNumber.of(128), P: PDFNumber.of(p), O: PDFHexString.of(bytesToHex(o)), U: PDFHexString.of(bytesToHex(u)) });
            trailer.Encrypt = context.register(encDict);
            return await pdfDoc.save({ useObjectStreams: false });
        },
        async decrypt(pdfBytes, password) {
            const { PDFDocument, PDFName, PDFHexString, PDFNumber, PDFRawStream } = PDFLib;
            // Load with ignoreEncryption to access the encrypted content
            const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
            const context = pdfDoc.context;
            const trailer = context.trailerInfo;

            const encryptRef = trailer.Encrypt;
            if (!encryptRef) return pdfBytes; // Not encrypted

            const encryptDict = context.lookup(encryptRef);
            const v = encryptDict.get(PDFName.of('V')).numberValue;
            const r = encryptDict.get(PDFName.of('R')).numberValue;

            if (v !== 2 || r !== 3) {
                throw new Error('Only Standard RC4 128-bit (V2, R3) encryption is supported. This PDF uses a newer standard (like AES-256) which is not supported yet.');
            }

            const p = encryptDict.get(PDFName.of('P')).numberValue;
            const o = hexToBytes(encryptDict.get(PDFName.of('O')).value);
            const u = hexToBytes(encryptDict.get(PDFName.of('U')).value);

            let fileId = new Uint8Array(16); // Default fallback
            const idArr = trailer.ID || context.trailerInfo.get(PDFName.of('ID'));
            if (idArr && idArr.array) {
                const firstId = idArr.array[0];
                if (firstId) {
                    const idStr = firstId.toString().replace(/^<|>$/g, '');
                    if (idStr) fileId = hexToBytes(idStr);
                }
            }

            // To verify password, we compute the encryption key and then the U key
            const ek = computeEncryptionKey(password, o, p, fileId);
            const computedU = computeUserKey(ek, fileId);

            // Standard check: first 16 bytes of computed U should match the PDF's U entry
            const uMatches = u.slice(0, 16).every((val, i) => val === computedU[i]);

            if (!uMatches) {
                throw new Error('Incorrect password.');
            }

            // Decrypt all objects
            for (const [ref, obj] of context.enumerateIndirectObjects()) {
                const num = ref.objectNumber, gen = ref.generationNumber || 0;
                if (obj === encryptDict) continue;

                if (obj instanceof PDFRawStream && obj.dict) {
                    const t = obj.dict.get(PDFName.of('Type'));
                    if (t && (t.toString() === '/XRef' || t.toString() === '/Sig')) continue;
                }

                if (obj instanceof PDFRawStream) {
                    // Decrypt stream contents (RC4 is symmetric)
                    obj.contents = encryptObj(obj.contents, num, gen, ek);
                    if (obj.dict) encryptStrings(obj.dict, num, gen, ek);
                } else {
                    encryptStrings(obj, num, gen, ek);
                }
            }

            // Remove encryption dictionary from trailer
            delete trailer.Encrypt;

            // Save the now decrypted PDF
            return await pdfDoc.save({ useObjectStreams: false });
        }
    };
})();

async function convertHtmlToPdf(element, filename, options = {}) {
    const { jsPDF } = window.jspdf;

    const pageSize = options.pageSize || 'a4';
    const orientation = options.orientation || 'auto';

    // Temporary styles for capturing full content without scrollbars
    const originalMaxHeight = element.style.maxHeight;
    const originalOverflowY = element.style.overflowY;

    element.style.maxHeight = 'none';
    element.style.overflowY = 'visible';

    // Apply page-break-inside avoid rules to prevent text lines, lists, tables, images from being cut across pages
    const avoidElements = element.querySelectorAll('p, h1, h2, h3, h4, h5, h6, tr, img, pre, code, li, blockquote');
    const originalAvoidStyles = [];
    avoidElements.forEach(el => {
        originalAvoidStyles.push({ el, breakInside: el.style.breakInside, pageBreakInside: el.style.pageBreakInside });
        el.style.breakInside = 'avoid';
        el.style.pageBreakInside = 'avoid';
    });

    // Calculate dimensions based on page size selection
    let defaultWidth = 595.28; // A4 portrait
    let defaultHeight = 841.89;
    if (pageSize === 'letter') {
        defaultWidth = 612;
        defaultHeight = 792;
    } else if (pageSize === 'a3') {
        defaultWidth = 841.89;
        defaultHeight = 1190.55;
    }

    let isLandscape = false;
    if (orientation === 'l') {
        isLandscape = true;
    } else if (orientation === 'p') {
        isLandscape = false;
    } else {
        // Auto-detect based on element dimensions
        const elWidth = element.offsetWidth || 794;
        const elHeight = element.offsetHeight || 1123;
        isLandscape = elWidth > elHeight;
    }

    const imgWidth = isLandscape ? defaultHeight : defaultWidth;
    const pageHeight = isLandscape ? defaultWidth : defaultHeight;

    try {
        const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'pt', pageSize);

        // Use modern jsPDF html utility for natural text and element pagination without content cutting
        await new Promise((resolve, reject) => {
            pdf.html(element, {
                x: 0,
                y: 0,
                width: imgWidth,
                windowWidth: element.offsetWidth || 794,
                autoPaging: 'text',
                margin: [20, 20, 20, 20],
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false
                },
                callback: function (doc) {
                    const _w2pBlob = doc.output('blob');
                    const _w2pUrl = URL.createObjectURL(_w2pBlob);
                    const _w2pLink = document.createElement('a');
                    _w2pLink.href = _w2pUrl;
                    _w2pLink.download = filename;
                    _w2pLink.click();
                    URL.revokeObjectURL(_w2pUrl);
                    resolve();
                }
            });
        });
    } catch (err) {
        console.warn('pdf.html failed, falling back to manual canvas slicing:', err);
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const imgHeight = (canvasHeight * imgWidth) / canvasWidth;

            const pdfFallback = new jsPDF(isLandscape ? 'l' : 'p', 'pt', pageSize);
            let heightLeft = imgHeight;
            let position = 0;

            pdfFallback.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdfFallback.addPage();
                pdfFallback.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const _fbBlob = pdfFallback.output('blob');
            const _fbUrl = URL.createObjectURL(_fbBlob);
            const _fbLink = document.createElement('a');
            _fbLink.href = _fbUrl;
            _fbLink.download = filename;
            _fbLink.click();
            URL.revokeObjectURL(_fbUrl);
        } catch (fallbackErr) {
            console.error('HTML to PDF fallback conversion failed:', fallbackErr);
            throw fallbackErr;
        }
    } finally {
        // Restore original styles
        element.style.maxHeight = originalMaxHeight;
        element.style.overflowY = originalOverflowY;
        originalAvoidStyles.forEach(item => {
            item.el.style.breakInside = item.breakInside;
            item.el.style.pageBreakInside = item.pageBreakInside;
        });
    }
}
