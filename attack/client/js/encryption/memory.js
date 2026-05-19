/**
 * Memory Module
 * Multi-pass secure memory wiping to prevent key exposure.
 * Overwrites with random, zeros, random, zeros to defeat
 * single-snapshot memory dumps.
 */
;(function () {
    'use strict';

    var _wipe = function (typedArray) {
        if (!typedArray || !typedArray.buffer) return;

        // Pass 1: random overwrite
        crypto.getRandomValues(typedArray);
        // Pass 2: zero
        typedArray.fill(0);
        // Pass 3: random (defeats diff-based recovery)
        crypto.getRandomValues(typedArray);
        // Pass 4: final zero
        typedArray.fill(0);
    };

    // Expose as frozen, non-enumerable
    var api = Object.freeze({ clear_memory: _wipe });
    Object.defineProperty(window, 'MemoryModule', {
        value: api,
        writable: false,
        configurable: false,
        enumerable: false
    });
})();
