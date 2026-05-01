/**
 * Extortion Module
 * Handles the ransom note UI and simulated payment verification.
 */
document.addEventListener('DOMContentLoaded', () => {
    const victimIdEl = document.getElementById('victimId');
    const btnVerifyPayment = document.getElementById('btnVerifyPayment');
    const paymentStatusEl = document.getElementById('paymentStatus');

    if (!victimIdEl || !btnVerifyPayment) return;

    // Get victim ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const victimId = urlParams.get('victimId') || 'V-' + Math.floor(Math.random() * 1000000000);
    victimIdEl.textContent = victimId;

    // Simulate Payment Verification
    btnVerifyPayment.addEventListener('click', () => {
        btnVerifyPayment.disabled = true;
        btnVerifyPayment.textContent = "Verifying Transaction...";
        paymentStatusEl.style.display = 'block';
        paymentStatusEl.textContent = "Connecting to Bitcoin network...";
        paymentStatusEl.style.color = '#f59e0b'; // warning color

        // Simulate network delay
        setTimeout(() => {
            paymentStatusEl.textContent = "Error: Payment not found. Please ensure you have sent 0.5 BTC.";
            paymentStatusEl.style.color = '#ef4444'; // error color
            btnVerifyPayment.disabled = false;
            btnVerifyPayment.textContent = "Verify Payment & Decrypt";
        }, 3000);
    });
});
