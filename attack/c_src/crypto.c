#include <emscripten.h>
#include <string.h>
#include <stdlib.h>
#include <stdint.h>
#include "mbedtls/gcm.h"
#include "mbedtls/cipher.h"

/* ============================================================
 * Stealth AES-256-GCM WASM Module
 *
 * Design goals:
 *   1. Key material NEVER leaves WASM linear memory
 *   2. JS only receives opaque integer handles (pointers)
 *   3. All RNG seeded from JS entropy but mixed internally
 *   4. Aggressive multi-pass memory zeroization
 *   5. Internal key slot table with use-count & auto-destroy
 * ============================================================ */

/* ---- Stub for MbedTLS 3.6.0 Wasm build ---- */
int32_t mbedtls_psa_platform_get_builtin_key(
    uint32_t key_id,
    int32_t *lifetime,
    void **slot_number) {
    return -133; /* PSA_ERROR_DOES_NOT_EXIST */
}

/* ---- Key Slot Table ---- */
#define MAX_KEY_SLOTS  32
#define KEY_SIZE       32   /* AES-256 = 32 bytes */
#define IV_SIZE        12
#define TAG_SIZE       16

typedef struct {
    uint8_t  key[KEY_SIZE];
    uint8_t  occupied;       /* 1 = in use */
    uint32_t use_count;      /* encrypt calls made with this key */
    uint32_t max_uses;       /* auto-destroy after N uses (0 = unlimited) */
} key_slot_t;

static key_slot_t g_key_slots[MAX_KEY_SLOTS];

/* ---- Secure Memory Wipe ---- */

/**
 * Multi-pass wipe: pattern fill -> zero -> inverted pattern -> zero.
 * Prevents single-snapshot cold-boot recovery.
 */
static void secure_wipe(void *ptr, size_t len) {
    volatile unsigned char *p = (volatile unsigned char *)ptr;
    size_t i;

    /* Pass 1: 0xAA pattern */
    for (i = 0; i < len; i++) p[i] = 0xAA;
    /* Pass 2: zero */
    for (i = 0; i < len; i++) p[i] = 0x00;
    /* Pass 3: 0x55 pattern (bitwise inverse of 0xAA) */
    for (i = 0; i < len; i++) p[i] = 0x55;
    /* Pass 4: final zero */
    for (i = 0; i < len; i++) p[i] = 0x00;
}

/* ---- Internal PRNG (ChaCha8-like quarter-round mixer) ---- */

static uint32_t g_rng_state[4] = { 0x6B175474, 0xE89094C4, 0x4DA5CB0A, 0xB7DCD62A };

static uint32_t rotl32(uint32_t x, int n) {
    return (x << n) | (x >> (32 - n));
}

static void rng_mix(void) {
    /* Simplified ChaCha quarter-round for mixing */
    g_rng_state[0] += g_rng_state[1]; g_rng_state[3] ^= g_rng_state[0]; g_rng_state[3] = rotl32(g_rng_state[3], 16);
    g_rng_state[2] += g_rng_state[3]; g_rng_state[1] ^= g_rng_state[2]; g_rng_state[1] = rotl32(g_rng_state[1], 12);
    g_rng_state[0] += g_rng_state[1]; g_rng_state[3] ^= g_rng_state[0]; g_rng_state[3] = rotl32(g_rng_state[3], 8);
    g_rng_state[2] += g_rng_state[3]; g_rng_state[1] ^= g_rng_state[2]; g_rng_state[1] = rotl32(g_rng_state[1], 7);
}

static void rng_fill(uint8_t *buf, size_t len) {
    size_t i;
    for (i = 0; i < len; i++) {
        if ((i & 3) == 0) rng_mix();
        buf[i] = (uint8_t)(g_rng_state[i & 3] >> ((i & 3) * 8));
    }
}

/**
 * Seed the internal PRNG with external entropy from JS.
 * JS should call this with crypto.getRandomValues() output.
 * The entropy is XOR-mixed into state, not replacing it,
 * so multiple seed calls strengthen the state.
 */
EMSCRIPTEN_KEEPALIVE
void rng_seed(const uint8_t *entropy, size_t len) {
    size_t i;
    for (i = 0; i < len && i < 16; i++) {
        ((uint8_t *)g_rng_state)[i % 16] ^= entropy[i];
    }
    /* Extra mixing rounds after seeding */
    for (i = 0; i < 20; i++) rng_mix();
}

/* ---- Key Management API ---- */

/**
 * Generate a 256-bit AES key entirely inside WASM memory.
 * Returns a slot index (opaque handle). -1 on error.
 *
 * @param entropy     External entropy bytes from JS (crypto.getRandomValues)
 * @param entropy_len Length of entropy (>= 32 recommended)
 * @param max_uses    Auto-destroy after N encryptions (0 = unlimited)
 * @return            Slot index [0..MAX_KEY_SLOTS-1] or -1
 */
EMSCRIPTEN_KEEPALIVE
int key_generate(const uint8_t *entropy, size_t entropy_len, uint32_t max_uses) {
    int slot = -1;
    int i;

    /* Find free slot */
    for (i = 0; i < MAX_KEY_SLOTS; i++) {
        if (!g_key_slots[i].occupied) { slot = i; break; }
    }
    if (slot < 0) return -1; /* no free slots */

    /* Seed PRNG with external entropy */
    rng_seed(entropy, entropy_len);

    /* Generate key from internal PRNG (entropy never stored as-is) */
    rng_fill(g_key_slots[slot].key, KEY_SIZE);

    g_key_slots[slot].occupied  = 1;
    g_key_slots[slot].use_count = 0;
    g_key_slots[slot].max_uses  = max_uses;

    /* Wipe the entropy from WASM input region */
    secure_wipe((void *)entropy, entropy_len);

    return slot;
}

/**
 * Export raw key bytes from a slot to a caller-provided buffer,
 * then immediately destroy the slot.
 * Use only when you need to RSA-wrap the key externally.
 *
 * @param slot    Key slot index
 * @param out_key Buffer to receive 32 raw key bytes
 * @return        1 on success, 0 on error
 */
EMSCRIPTEN_KEEPALIVE
int key_export_and_destroy(int slot, uint8_t *out_key) {
    if (slot < 0 || slot >= MAX_KEY_SLOTS) return 0;
    if (!g_key_slots[slot].occupied) return 0;

    memcpy(out_key, g_key_slots[slot].key, KEY_SIZE);

    /* Destroy slot */
    secure_wipe(g_key_slots[slot].key, KEY_SIZE);
    g_key_slots[slot].occupied  = 0;
    g_key_slots[slot].use_count = 0;
    g_key_slots[slot].max_uses  = 0;

    return 1;
}

/**
 * Destroy a key slot without exporting.
 * @return 1 on success, 0 on error
 */
EMSCRIPTEN_KEEPALIVE
int key_destroy(int slot) {
    if (slot < 0 || slot >= MAX_KEY_SLOTS) return 0;
    if (!g_key_slots[slot].occupied) return 0;

    secure_wipe(g_key_slots[slot].key, KEY_SIZE);
    g_key_slots[slot].occupied  = 0;
    g_key_slots[slot].use_count = 0;
    g_key_slots[slot].max_uses  = 0;

    return 1;
}

/**
 * Destroy ALL key slots. Emergency wipe.
 */
EMSCRIPTEN_KEEPALIVE
void key_destroy_all(void) {
    int i;
    for (i = 0; i < MAX_KEY_SLOTS; i++) {
        if (g_key_slots[i].occupied) {
            secure_wipe(g_key_slots[i].key, KEY_SIZE);
            g_key_slots[i].occupied  = 0;
            g_key_slots[i].use_count = 0;
            g_key_slots[i].max_uses  = 0;
        }
    }
    /* Also wipe PRNG state */
    secure_wipe(g_rng_state, sizeof(g_rng_state));
}

/* ---- Encrypt / Decrypt using Key Slots ---- */

/**
 * AES-256-GCM Encrypt using a key slot.
 * IV is generated internally from the PRNG and written to iv_out.
 * The raw key never touches the JS/caller side.
 *
 * @param slot         Key slot index
 * @param entropy      Fresh entropy from JS for IV generation (>= 16 bytes)
 * @param entropy_len  Length of entropy
 * @param input        Plaintext bytes
 * @param input_len    Plaintext length
 * @param output       Ciphertext buffer (>= input_len bytes)
 * @param tag          GCM auth tag buffer (16 bytes)
 * @param iv_out       IV buffer (12 bytes), filled by this function
 * @return             ciphertext_len + TAG_SIZE on success, 0 on error
 */
EMSCRIPTEN_KEEPALIVE
int seal_with_slot(int slot,
                   const uint8_t *entropy, size_t entropy_len,
                   const unsigned char *input, size_t input_len,
                   unsigned char *output, unsigned char *tag,
                   unsigned char *iv_out) {
    uint8_t iv[IV_SIZE];
    mbedtls_gcm_context ctx;
    int ret;

    if (slot < 0 || slot >= MAX_KEY_SLOTS) return 0;
    if (!g_key_slots[slot].occupied) return 0;

    /* Check max_uses */
    if (g_key_slots[slot].max_uses > 0 &&
        g_key_slots[slot].use_count >= g_key_slots[slot].max_uses) {
        /* Auto-destroy: key expired */
        key_destroy(slot);
        return 0;
    }

    /* Seed PRNG with fresh entropy, then generate IV internally */
    rng_seed(entropy, entropy_len);
    rng_fill(iv, IV_SIZE);

    /* Wipe entropy from input region */
    secure_wipe((void *)entropy, entropy_len);

    /* AES-GCM encrypt */
    mbedtls_gcm_init(&ctx);
    ret = mbedtls_gcm_setkey(&ctx, MBEDTLS_CIPHER_ID_AES,
                             g_key_slots[slot].key, 256);
    if (ret != 0) {
        mbedtls_gcm_free(&ctx);
        secure_wipe(iv, IV_SIZE);
        return 0;
    }

    ret = mbedtls_gcm_crypt_and_tag(&ctx, MBEDTLS_GCM_ENCRYPT, input_len,
                                    iv, IV_SIZE,
                                    NULL, 0,
                                    input, output, TAG_SIZE, tag);
    mbedtls_gcm_free(&ctx);

    if (ret != 0) {
        secure_wipe(iv, IV_SIZE);
        return 0;
    }

    /* Copy IV to caller buffer */
    memcpy(iv_out, iv, IV_SIZE);
    secure_wipe(iv, IV_SIZE);

    /* Increment use count */
    g_key_slots[slot].use_count++;

    /* Auto-destroy check after use */
    if (g_key_slots[slot].max_uses > 0 &&
        g_key_slots[slot].use_count >= g_key_slots[slot].max_uses) {
        key_destroy(slot);
    }

    return (int)(input_len + TAG_SIZE);
}

/* ---- Legacy API (kept for backward compatibility) ---- */

EMSCRIPTEN_KEEPALIVE
int aes_gcm_encrypt(const unsigned char *key,
                    const unsigned char *iv, size_t iv_len,
                    const unsigned char *input, size_t input_len,
                    unsigned char *output, unsigned char *tag) {
    mbedtls_gcm_context ctx;
    int ret;

    mbedtls_gcm_init(&ctx);
    ret = mbedtls_gcm_setkey(&ctx, MBEDTLS_CIPHER_ID_AES, key, 256);
    if (ret != 0) {
        mbedtls_gcm_free(&ctx);
        return 0;
    }

    ret = mbedtls_gcm_crypt_and_tag(&ctx, MBEDTLS_GCM_ENCRYPT, input_len,
                                    iv, iv_len,
                                    NULL, 0,
                                    input, output, TAG_SIZE, tag);
    mbedtls_gcm_free(&ctx);
    if (ret != 0) return 0;
    return (int)(input_len + TAG_SIZE);
}

EMSCRIPTEN_KEEPALIVE
int aes_gcm_decrypt(const unsigned char *key,
                    const unsigned char *iv, size_t iv_len,
                    const unsigned char *input, size_t input_len,
                    const unsigned char *tag,
                    unsigned char *output) {
    mbedtls_gcm_context ctx;
    int ret;

    mbedtls_gcm_init(&ctx);
    ret = mbedtls_gcm_setkey(&ctx, MBEDTLS_CIPHER_ID_AES, key, 256);
    if (ret != 0) {
        mbedtls_gcm_free(&ctx);
        return 0;
    }

    ret = mbedtls_gcm_auth_decrypt(&ctx, input_len,
                                   iv, iv_len,
                                   NULL, 0,
                                   tag, TAG_SIZE,
                                   input, output);
    mbedtls_gcm_free(&ctx);
    if (ret != 0) return 0;
    return (int)input_len;
}

/**
 * Wipe an arbitrary region of WASM linear memory.
 * Callable from JS to scrub buffers after use.
 */
EMSCRIPTEN_KEEPALIVE
void secure_wipe_region(void *ptr, size_t len) {
    secure_wipe(ptr, len);
}
