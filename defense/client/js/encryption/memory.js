/**
 * Memory Module
 * Implements clear_memory to prevent key exposure by overwriting memory
 * where the key is stored with random values.
 */
class MemoryModule {
    /**
     * Overwrites a typed array with cryptographically secure random values.
     * @param {TypedArray} typedArray - The array to clear
     */
    static clear_memory(typedArray) {
        if (!typedArray || !typedArray.buffer) return;
        
        // Fill with cryptographically secure random values
        window.crypto.getRandomValues(typedArray);
        
        // Fill with zeros
        for (let i = 0; i < typedArray.length; i++) {
            typedArray[i] = 0;
        }
    }
}

window.MemoryModule = MemoryModule;
