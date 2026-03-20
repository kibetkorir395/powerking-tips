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
          <!-- Status indicator removed - now hidden -->
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      width: '900px',
      didOpen: () => {
        // Start polling after 15 seconds to give user time to enter payment details
        setTimeout(() => {
          setPolling(true);
