// Function to open the payment modal with SweetAlert2
const openPaymentModal = (paymentUrl, trackingId) => {
  let pollInterval;
  let pollCount = 0;
  const MAX_POLLS = 60; // Poll for 5 minutes maximum (60 * 5 seconds)
  
  Swal.fire({
    title: 'Complete Your Payment',
    html: `
      <div style="width: 100%; height: 500px; overflow: hidden; position: relative;">
        <iframe 
          src="${paymentUrl}" 
          style="width: 100%; height: 100%; border: none;"
          title="Pesapal Payment"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-top-navigation-by-user-activation"
          allow="payment *;"
        ></iframe>
        <div id="payment-status" style="position: absolute; top: 10px; right: 10px; background: #f0f0f0; padding: 5px 10px; border-radius: 4px; display: none;">
          Checking payment status...
        </div>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    width: '900px',
    didOpen: () => {
      // Start polling after 15 seconds to give user time to enter payment details
      setTimeout(() => {
        setPolling(true);
        
        // Show polling indicator
        const statusDiv = document.getElementById('payment-status');
        if (statusDiv) {
          statusDiv.style.display = 'block';
        }
        
        pollInterval = setInterval(async () => {
          pollCount++;
          console.log(`Polling payment status (${pollCount}/${MAX_POLLS}) for:`, trackingId);
          
          try {
            const paymentData = {
              orderTrackingId: trackingId,
              consumerKey: "nbZBtDnSEt9X+l0cHNDFren+7dTQIJXl",
              consumerSecret: "3p2NhatNMO64hzQpqGUs062LTvE="
            };

            const res = await fetch(`https://all-payments-api-production.up.railway.app/api/pesapal/status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(paymentData),
            });
          
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            
            const data = await res.json();
            console.log('Payment Status:', data);
            
            // Check payment status based on Pesapal docs
            const status = data.payment_status_description || '';
            const statusCode = data.status_code;
            
            // Only consider it completed if status is explicitly COMPLETED
            if (status === 'COMPLETED' || statusCode === 1) {
              clearInterval(pollInterval);
              setPolling(false);
              Swal.close();
              await handleUpgrade();
              return;
            } 
            // Only show error for final failed states, not initial "INVALID" state
            else if (status === 'FAILED' || statusCode === 2) {
              clearInterval(pollInterval);
              setPolling(false);
              Swal.close();
              alert('Payment failed. Please try again.');
              return;
            }
            else if (status === 'REVERSED' || statusCode === 3) {
              clearInterval(pollInterval);
              setPolling(false);
              Swal.close();
              alert('Payment was reversed. Please contact support.');
              return;
            }
            
            // Stop polling after maximum attempts
            if (pollCount >= MAX_POLLS) {
              clearInterval(pollInterval);
              setPolling(false);
              Swal.close();
              alert('Payment status check timed out. Please check your email for confirmation or contact support.');
            }
          } catch (err) {
            console.error('Error checking payment status:', err);
          }
        }, 5000); // Poll every 5 seconds
      }, 15000); // Start polling after 15 seconds
    },
    willClose: () => {
      // Clean up polling
      if (pollInterval) {
        clearInterval(pollInterval);
        setPolling(false);
      }
    }
  });
};
