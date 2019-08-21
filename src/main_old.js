const wasmCode = require('../dist/life-web.wasm');
require('./wasm_exec');



class PayloadBuilder {
    /**
     * A payload builder made for easier handling of binary serialization of
     * data for Wavelet to ingest.
     */
    constructor() {
        this.buf = new ArrayBuffer(0);
        this.view = new DataView(this.buf);
        this.offset = 0;
    }

    /**
     * Resizes the underlying buffer should it not be large enough to handle
     * some chunk of data to be appended to buffer.
     *
     * @param {number} size Size of data to be appended to the buffer.
     */
    resizeIfNeeded(size) {
        if (this.offset + size > this.buf.byteLength) {
            this.buf = ArrayBuffer.transfer(this.buf, this.offset + size);
            this.view = new DataView(this.buf);
        }
    }

    /**
     * Write a single byte to the payload buffer.
     *
     * @param {number} n A single byte.
     */
    writeByte(n) {
        this.resizeIfNeeded(1);
        this.view.setUint8(this.offset, n);
        this.offset += 1;
    }

    /**
     * Write an signed little-endian 16-bit integer to the payload buffer.
     *
     * @param {number} n
     */
    writeInt16(n) {
        this.resizeIfNeeded(2);
        this.view.setInt16(this.offset, n, true);
        this.offset += 2;
    }

    /**
     * Write an signed little-endian 32-bit integer to the payload buffer.
     *
     * @param {number} n
     */
    writeInt32(n) {
        this.resizeIfNeeded(4);
        this.view.setInt32(this.offset, n, true);
        this.offset += 4;
    }

    /**
     * Write a signed little-endian 64-bit integer to the payload buffer.
     *
     * @param {bigint} n
     */
    writeInt64(n) {
        this.resizeIfNeeded(8);
        this.view.setBigInt64(this.offset, n, true);
        this.offset += 8;
    }

    /**
     * Write an unsigned little-endian 16-bit integer to the payload buffer.
     *
     * @param {number} n
     */
    writeUint16(n) {
        this.resizeIfNeeded(2);
        this.view.setUint16(this.offset, n, true);
        this.offset += 2;
    }

    /**
     * Write an unsigned little-endian 32-bit integer to the payload buffer.
     *
     * @param {number} n
     */
    writeUint32(n) {
        this.resizeIfNeeded(4);
        this.view.setUint32(this.offset, n, true);
        this.offset += 4;
    }

    /**
     * Write an unsigned little-endian 64-bit integer to the payload buffer.
     *
     * @param {bigint} n
     */
    writeUint64(n) {
        this.resizeIfNeeded(8);
        this.view.setBigUint64(this.offset, n, true);
        this.offset += 8;
    }

    /**
     * Write a series of bytes to the payload buffer.
     *
     * @param {ArrayBufferLike} buf
     */
    writeBytes(buf) {
        this.resizeIfNeeded(buf.byteLength);
        new Uint8Array(this.buf, this.offset, buf.byteLength).set(buf);
        this.offset += buf.byteLength;
    }

    /**
     * Returns the raw bytes of the payload buffer.
     *
     * @returns {Uint8Array}
     */
    getBytes() {
        return new Uint8Array(this.buf.slice(0, this.offset));
    }
}

function parseFunctionParams(...params) {
    const builder = new PayloadBuilder();

    params.forEach(param => {
        switch (param.type) {
            case "int16":
                builder.writeInt16(param.value);
                break;
            case "int32":
                builder.writeInt32(param.value);
                break;
            case "int64":
                builder.writeInt64(param.value);
            case "uint16":
                builder.writeUint16(param.value);
                break;
            case "uint32":
                builder.writeUint32(param.value);
                break;
            case "uint64":
                builder.writeUint64(param.value);
                break;
            case "byte":
                builder.writeByte(param.value);
                break;
            case "raw":
                if (typeof param.value === "string") { // Assume that it is hex-encoded.
                    param.value = new Uint8Array(param.value.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16)));
                }

                builder.writeBytes(param.value);
                break;
            case "bytes":
                if (typeof param.value === "string") { // Assume that it is hex-encoded.
                    param.value = new Uint8Array(param.value.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16)));
                }

                builder.writeUint32(param.value.byteLength);
                builder.writeBytes(param.value);
                break;
            case "string":
                builder.writeBytes(Buffer.from(param.value, 'utf8'));
                builder.writeByte(0);
                break;
        }
    });

    return builder.getBytes();
}


function rebuildContractPayload(contract_payload) {
    const builder = new PayloadBuilder();
    builder.writeUint64(contract_payload.round_idx);
    builder.writeBytes(Buffer.from(contract_payload.round_id, "hex"));
    builder.writeBytes(Buffer.from(contract_payload.transaction_id, "hex"));
    builder.writeBytes(Buffer.from(contract_payload.sender_id, "hex"));
    builder.writeUint64(contract_payload.amount);
    builder.writeBytes(contract_payload.params);

    return builder.getBytes();
}


const gasEstimate = {
    memory: [],
    vm: null,
    async init() {
        const go = new Go();
        const imports = {
            env: {
                abort: () => {
                },
                _send_transaction: (tag, payload_ptr, payload_len) => {
                    // const payload_view = new Uint8Array(this.vm.instance.exports.memory.buffer, payload_ptr, payload_len);
                    // const payload = this.decoder.decode(payload_view);
                    // console.log(`Sent transaction with tag ${tag} and payload ${params}.`);
                },
                _payload_len: () => {
                    return gasEstimate.memory.byteLength;
                },
                _payload: payload_ptr => {
                    const view = new Uint8Array(gasEstimate.vm.instance.exports.memory.buffer, payload_ptr, gasEstimate.memory.byteLength);
                    view.set(gasEstimate.memory);
                },
                _result: (ptr, len) => {
                    const result = new Uint8Array(gasEstimate.vm.instance.exports.memory.buffer, ptr, len);
                    console.log('result', result);
                },
                _log: (ptr, len) => {
                    const view = new Uint8Array(gasEstimate.vm.instance.exports.memory.buffer, ptr, len);
                    // this.logs.push(this.decoder.decode(view));
                    console.log('log', view);
                },
                _verify_ed25519: () => {
                },
                _hash_blake2b_256: () => {
                },
                _hash_sha256: () => {
                },
                _hash_sha512: () => {
                },
            }
        }
        // const response = await fetch(lifeWebPath);
        // const buffer = await response.arrayBuffer();
        gasEstimate.vm = await WebAssembly.instantiate(wasmCode, {
            ...go.importObject,
            ...imports
        });
        let inst = gasEstimate.vm.instance;
        go.run(inst);
    },

    async run(contract, func_name, amount_to_send, func_params = [], limit = 10000000000) {
        if (!window.life) {
            await gasEstimate.init();
        }
        let code;
        if (typeof contract === "string") {
            const codeBuf = await (await fetch(contract)).arrayBuffer();
            code = new Uint8Array(codeBuf);
        } else {
            code = contract.code;
        }
        const contract_payload = {
            round_idx: BigInt(0),
            round_id: "0000000000000000000000000000000000000000000000000000000000000000",
            transaction_id: "0000000000000000000000000000000000000000000000000000000000000000",
            sender_id: "0000000000000000000000000000000000000000000000000000000000000000",
            amount: BigInt(amount_to_send),
            params: new Uint8Array(new ArrayBuffer(0)),
        };
        // contract_payload.params = parseFunctionParams([]);
        contract_payload.amount = BigInt(amount_to_send);
        // contract_payload.sender_id = "";
        gasEstimate.memory = rebuildContractPayload(contract_payload);
        const copy = ArrayBuffer.transfer(gasEstimate.vm.instance.exports.mem.buffer, gasEstimate.vm.instance.exports.mem.buffer.byteLength);
        console.log(gasEstimate.memory, gasEstimate.memory.length, gasEstimate.memory.byteLength);
        const ret = window.life.run_with_gas_limit(
            code,
            limit + "",
            gasEstimate.memory,
            func_name
        );

        return ret;
    }
};
module.exports = gasEstimate;