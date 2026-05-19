#!/bin/bash
set -e

echo "Starting Wasm build process using Docker (emscripten/emsdk)..."

sudo docker run --rm -v $(pwd)/..:/workspace -w /workspace/c_src emscripten/emsdk /bin/bash -c "
echo 'Checking for MbedTLS...'
if [ ! -d mbedtls ]; then
    echo 'Downloading MbedTLS 3.6.0...'
    wget -q https://github.com/Mbed-TLS/mbedtls/archive/refs/tags/v3.6.0.tar.gz
    tar -xf v3.6.0.tar.gz
    mv mbedtls-3.6.0 mbedtls
    rm v3.6.0.tar.gz

    echo 'Configuring MbedTLS for baremetal (Wasm compatibility)...'
    cd mbedtls
    python3 scripts/config.py baremetal
    # Disable PSA Crypto features which cause missing symbols during Wasm compilation
    python3 scripts/config.py unset MBEDTLS_PSA_CRYPTO_C
    python3 scripts/config.py unset MBEDTLS_USE_PSA_CRYPTO
    cd ..
fi

echo 'Compiling C source to WebAssembly (stealth build)...'
emcc crypto.c mbedtls/library/*.c -I mbedtls/include \
    -O3 \
    -s EXPORTED_FUNCTIONS=\"[
        '_aes_gcm_encrypt', '_aes_gcm_decrypt',
        '_rng_seed',
        '_key_generate', '_key_export_and_destroy', '_key_destroy', '_key_destroy_all',
        '_seal_with_slot',
        '_secure_wipe_region',
        '_malloc', '_free'
    ]\" \
    -s EXPORTED_RUNTIME_METHODS=\"['ccall', 'cwrap']\" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s WASM=1 \
    -o ../client/js/encryption/wasm/crypto.js

echo 'Build successful! Wasm and JS glue code are at client/js/encryption/wasm/'
"
