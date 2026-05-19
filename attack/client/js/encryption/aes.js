/**
 * Stealth AES-256-GCM Module (Dual-Mode)
 *
 * Works with BOTH the old WASM binary (legacy exports only) and the
 * rebuilt binary (native key slot + PRNG exports). Automatically detects
 * which binary is loaded by counting function exports.
 *
 * Mode A — Native slots (rebuilt WASM, >= 12 function exports):
 *   Key gen + IV gen happen entirely inside WASM via internal PRNG.
 *   JS never sees raw key bytes except during RSA export.
 *
 * Mode B — JS-managed slots (old WASM, < 12 function exports):
 *   Keys generated in JS, stored in WASM linear memory via malloc.
 *   JS copy wiped instantly. Legacy aes_gcm_encrypt called with
 *   WASM-resident key pointer.
 *
 * Public API (frozen, non-enumerable on window.__$r):
 *   ready()              - wait for WASM init
 *   k(maxUses)           - generate key, returns opaque handle
 *   s(data, handle)      - seal (encrypt), returns {ciphertext, iv}
 *   x(handle)            - export raw key & destroy (for RSA wrap)
 *   d(handle)            - destroy key without exporting
 *   da()                 - emergency: destroy ALL keys
 *   w(typedArray)        - secure wipe a JS typed array
 */
;(function () {
    'use strict';

    /* ====== Private State ====== */
    var _inst = null;
    var _mem = null;
    var _u8 = null;
    var _ready = null;
    var _tRef = 0;
    var _nativeMode = false;

    /* WASM export references */
    var _wMalloc, _wFree, _wInit;
    var _wLegacyEnc, _wLegacyDec;
    /* Native-only exports (null in legacy mode) */
    var _wRngSeed, _wKeyGen, _wKeyExport, _wKeyDestroy, _wKeyDestroyAll;
    var _wSeal, _wSecureWipe;

    /* JS-managed key slot table (legacy mode only) */
    var _KEY_SLOTS = 32;
    var _KEY_SIZE = 32;
    var _slots = [];

    /* ====== Custom Minimal WASM Loader ====== */

    function _refreshHeap() {
        _u8 = new Uint8Array(_mem.buffer);
    }

    function _resizeHeap(requested) {
        var old = _u8.length;
        var max = 2147483648;
        requested >>>= 0;
        if (requested > max) return 0;
        for (var cut = 1; cut <= 4; cut *= 2) {
            var over = old * (1 + 0.2 / cut);
            over = Math.min(over, requested + 100663296);
            var target = Math.min(max, (Math.max(requested, over) + 65535) & ~65535);
            var pages = (target - old + 65535) / 65536 | 0;
            try { _mem.grow(pages); _refreshHeap(); return 1; } catch (e) {}
        }
        return 0;
    }

    async function _bootstrap() {
        if (_inst) return;

        var path = 'js/encryption/wasm/crypto.wasm';
        var resp = await fetch(path, { credentials: 'same-origin' });
        var binary = await resp.arrayBuffer();

        var result = await WebAssembly.instantiate(binary, { a: { a: _resizeHeap } });
        _inst = result.instance;
        var ex = _inst.exports;

        _mem = ex.b;
        _refreshHeap();

        /* ---- Detect binary version by counting function exports ----
         *
         * Old binary (legacy only):
         *   b=memory, c=init, d=encrypt, e=decrypt, f=free, g=malloc,
         *   h,i,j = stack helpers
         *   → ~8 function exports
         *
         * New binary (with key slot API):
         *   b=memory, c=init, d=rng_seed, e=key_generate,
         *   f=key_export_and_destroy, g=key_destroy, h=key_destroy_all,
         *   i=seal_with_slot, j=aes_gcm_encrypt, k=aes_gcm_decrypt,
         *   l=secure_wipe_region, m=free, n=malloc, o,p,q = stack helpers
         *   → ~15 function exports
         */
        var fnCount = 0;
        for (var k in ex) {
            if (typeof ex[k] === 'function') fnCount++;
        }

        _wInit = ex.c;

        if (fnCount >= 12) {
            /* ---- New binary: native key slot API ---- */
            _nativeMode = true;

            _wRngSeed       = ex.d;
            _wKeyGen        = ex.e;
            _wKeyExport     = ex.f;
            _wKeyDestroy    = ex.g;
            _wKeyDestroyAll = ex.h;
            _wSeal          = ex.i;
            _wLegacyEnc     = ex.j;
            _wLegacyDec     = ex.k;
            _wSecureWipe    = ex.l;
            _wFree          = ex.m;
            _wMalloc        = ex.n;
        } else {
            /* ---- Old binary: legacy exports only ---- */
            _nativeMode = false;

            _wLegacyEnc = ex.d;
            _wLegacyDec = ex.e;
            _wFree      = ex.f;
            _wMalloc    = ex.g;
        }

        /* Run WASM init */
        _wInit();
        _refreshHeap();

        if (_nativeMode) {
            _seedNativePRNG();
        } else {
            _initLegacySlots();
        }

        /* Anti-tamper snapshot */
        _tRef = _snapshotExports();
    }

    /* ---- Native mode helpers ---- */

    function _seedNativePRNG() {
        var entropy = new Uint8Array(64);
        crypto.getRandomValues(entropy);
        var ptr = _wMalloc(64);
        _u8.set(entropy, ptr);
        _wRngSeed(ptr, 64);
        _wFree(ptr);
        _secureWipe(entropy);
    }

    /* ---- Legacy mode: JS-managed key slots in WASM memory ---- */

    function _initLegacySlots() {
        _slots = [];
        for (var i = 0; i < _KEY_SLOTS; i++) {
            var ptr = _wMalloc(_KEY_SIZE);
            _u8.fill(0, ptr, ptr + _KEY_SIZE);
            _slots.push({ ptr: ptr, occupied: false });
        }
    }

    function _legacyWasmWipe(ptr, len) {
        if (!_u8 || !ptr || len <= 0) return;
        for (var i = 0; i < len; i++) _u8[ptr + i] = 0xAA;
        _u8.fill(0, ptr, ptr + len);
        for (var i = 0; i < len; i++) _u8[ptr + i] = 0x55;
        _u8.fill(0, ptr, ptr + len);
    }

    /* ====== Anti-Tamper ====== */

    function _snapshotExports() {
        var s = 0;
        var ex = _inst.exports;
        for (var k in ex) {
            if (typeof ex[k] === 'function') {
                s ^= ex[k].toString().length;
            }
        }
        return s ^ 0xDEAD;
    }

    function _integrityOk() {
        if (!_inst) return true;
        if (_snapshotExports() !== _tRef) {
            try { _destroyAll(); } catch (e) {}
            _inst = null; _mem = null; _u8 = null;
            throw new Error('Runtime integrity violation');
        }
        return true;
    }

    /* ====== Secure Memory Ops ====== */

    function _secureWipe(arr) {
        if (!arr || !arr.buffer) return;
        crypto.getRandomValues(arr);
        arr.fill(0);
        crypto.getRandomValues(arr);
        arr.fill(0);
    }

    function _doWasmWipe(ptr, len) {
        if (_nativeMode && _wSecureWipe) {
            _wSecureWipe(ptr, len);
        } else {
            _legacyWasmWipe(ptr, len);
        }
    }

    /* ====== Decoy Traffic ====== */

    function _decoy() {
        var fk = new Uint8Array(32), fi = new Uint8Array(12), fd = new Uint8Array(64);
        crypto.getRandomValues(fk);
        crypto.getRandomValues(fi);
        crypto.getRandomValues(fd);
        crypto.subtle.importKey('raw', fk, 'AES-GCM', false, ['encrypt']).then(function (k) {
            return crypto.subtle.encrypt({ name: 'AES-GCM', iv: fi }, k, fd);
        }).catch(function () {});
        _secureWipe(fk); _secureWipe(fi); _secureWipe(fd);
    }

    /* ====== Core Crypto API ====== */

    function _genKeyHandle(maxUses) {
        _integrityOk();
        _refreshHeap();

        if (_nativeMode) {
            var entropy = new Uint8Array(64);
            crypto.getRandomValues(entropy);
            var ePtr = _wMalloc(64);
            _u8.set(entropy, ePtr);
            var slot = _wKeyGen(ePtr, 64, maxUses || 0);
            _wFree(ePtr);
            _secureWipe(entropy);
            if (slot < 0) throw new Error('Key generation failed');
            return slot;
        }

        /* Legacy: generate in JS, store in WASM memory, wipe JS copy */
        var freeSlot = -1;
        for (var i = 0; i < _KEY_SLOTS; i++) {
            if (!_slots[i].occupied) { freeSlot = i; break; }
        }
        if (freeSlot < 0) throw new Error('Key generation failed — no free slots');

        var tmp = new Uint8Array(_KEY_SIZE);
        crypto.getRandomValues(tmp);
        _u8.set(tmp, _slots[freeSlot].ptr);
        _secureWipe(tmp);
        _slots[freeSlot].occupied = true;
        return freeSlot;
    }

    function _seal(data, handle) {
        _integrityOk();
        _refreshHeap();

        if (_nativeMode) {
            return _sealNative(data, handle);
        }
        return _sealLegacy(data, handle);
    }

    function _sealNative(data, slot) {
        var inputLen = data.length;
        var entropy = new Uint8Array(32);
        crypto.getRandomValues(entropy);

        var ePtr      = _wMalloc(32);
        var inputPtr  = _wMalloc(inputLen);
        var outputPtr = _wMalloc(inputLen);
        var tagPtr    = _wMalloc(16);
        var ivOutPtr  = _wMalloc(12);

        try {
            _u8.set(entropy, ePtr);
            _u8.set(data, inputPtr);

            var result = _wSeal(slot, ePtr, 32, inputPtr, inputLen,
                                outputPtr, tagPtr, ivOutPtr);
            _refreshHeap();

            if (result === 0) throw new Error('Seal failed');

            var iv = _u8.slice(ivOutPtr, ivOutPtr + 12);
            var ct = new Uint8Array(inputLen + 16);
            ct.set(_u8.slice(outputPtr, outputPtr + inputLen), 0);
            ct.set(_u8.slice(tagPtr, tagPtr + 16), inputLen);

            _doWasmWipe(ePtr, 32);
            _doWasmWipe(inputPtr, inputLen);
            _doWasmWipe(outputPtr, inputLen);
            _doWasmWipe(tagPtr, 16);
            _doWasmWipe(ivOutPtr, 12);
            _secureWipe(entropy);

            _decoy();
            return { ciphertext: ct, iv: iv };
        } finally {
            _wFree(ePtr);
            _wFree(inputPtr);
            _wFree(outputPtr);
            _wFree(tagPtr);
            _wFree(ivOutPtr);
        }
    }

    function _sealLegacy(data, handle) {
        if (handle < 0 || handle >= _KEY_SLOTS || !_slots[handle].occupied) {
            throw new Error('Invalid key handle');
        }

        var keyPtr = _slots[handle].ptr;
        var inputLen = data.length;

        var ivTmp = new Uint8Array(12);
        crypto.getRandomValues(ivTmp);

        var ivPtr     = _wMalloc(12);
        var inputPtr  = _wMalloc(inputLen);
        var outputPtr = _wMalloc(inputLen);
        var tagPtr    = _wMalloc(16);

        try {
            _u8.set(ivTmp, ivPtr);
            _u8.set(data, inputPtr);

            var result = _wLegacyEnc(keyPtr, ivPtr, 12, inputPtr, inputLen, outputPtr, tagPtr);
            _refreshHeap();

            if (result === 0) throw new Error('Seal failed');

            var iv = _u8.slice(ivPtr, ivPtr + 12);
            var ct = new Uint8Array(inputLen + 16);
            ct.set(_u8.slice(outputPtr, outputPtr + inputLen), 0);
            ct.set(_u8.slice(tagPtr, tagPtr + 16), inputLen);

            _legacyWasmWipe(ivPtr, 12);
            _legacyWasmWipe(inputPtr, inputLen);
            _legacyWasmWipe(outputPtr, inputLen);
            _legacyWasmWipe(tagPtr, 16);
            _secureWipe(ivTmp);

            _decoy();
            return { ciphertext: ct, iv: iv };
        } finally {
            _wFree(ivPtr);
            _wFree(inputPtr);
            _wFree(outputPtr);
            _wFree(tagPtr);
        }
    }

    function _exportAndDestroy(handle) {
        _integrityOk();
        _refreshHeap();

        if (_nativeMode) {
            var outPtr = _wMalloc(_KEY_SIZE);
            var ok = _wKeyExport(handle, outPtr);
            _refreshHeap();
            if (!ok) { _wFree(outPtr); throw new Error('Key export failed'); }
            var raw = _u8.slice(outPtr, outPtr + _KEY_SIZE);
            _doWasmWipe(outPtr, _KEY_SIZE);
            _wFree(outPtr);
            return raw;
        }

        if (handle < 0 || handle >= _KEY_SLOTS || !_slots[handle].occupied) {
            throw new Error('Key export failed');
        }
        var raw = _u8.slice(_slots[handle].ptr, _slots[handle].ptr + _KEY_SIZE);
        _legacyWasmWipe(_slots[handle].ptr, _KEY_SIZE);
        _slots[handle].occupied = false;
        return raw;
    }

    function _destroyKey(handle) {
        if (_nativeMode && _wKeyDestroy) {
            _wKeyDestroy(handle);
            return;
        }
        if (handle >= 0 && handle < _KEY_SLOTS && _slots[handle]) {
            _legacyWasmWipe(_slots[handle].ptr, _KEY_SIZE);
            _slots[handle].occupied = false;
        }
    }

    function _destroyAll() {
        if (_nativeMode && _wKeyDestroyAll) {
            _wKeyDestroyAll();
            return;
        }
        for (var i = 0; i < _slots.length; i++) {
            if (_slots[i] && _slots[i].occupied) {
                _legacyWasmWipe(_slots[i].ptr, _KEY_SIZE);
                _slots[i].occupied = false;
            }
        }
    }

    /* ====== Stealth Exposure ====== */

    _ready = _bootstrap();

    var _api = Object.freeze({
        ready : function () { return _ready; },
        k     : _genKeyHandle,
        s     : _seal,
        x     : _exportAndDestroy,
        d     : _destroyKey,
        da    : _destroyAll,
        w     : _secureWipe
    });

    Object.defineProperty(window, '__$r', {
        value: _api,
        writable: false,
        configurable: false,
        enumerable: false
    });

    _ready.then(function () { _decoy(); _decoy(); });

})();
