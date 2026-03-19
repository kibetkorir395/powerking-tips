// PesapalPayments.jsx
import React, { useContext, useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import './Ticket.scss';
import { PriceContext } from '../../PriceContext';
import AppHelmet from '../../components/AppHelmet';
import { AuthContext } from '../../AuthContext';
import { db, getUser, updateUser } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import Loader from '../../components/Loader/Loader';
import { useNavigate } from 'react-router-dom';

// Payment handling functions
const handlePayment = async (
  amount, 
  email, 
  description, 
  redirectPath, 
  setLoading, 
  setNotification, 
  openPaymentModal,
  handleUpgrade,
  setOrderTrackingId
) => {
  const paymentData = {
    amount: 5,
    email,
    description,
    countryCode: "KE",
    currency: "KES",
    url: window.location.origin + window.location.pathname,
    callbackUrl: window.location.origin + redirectPath,
    consumerKey: "nbZBtDnSEt9X+l0cHNDFren+7dTQIJXl",
    consumerSecret: "3p2NhatNMO64hzQpqGUs062LTvE="
  };

  setLoading(true);
  try {
    const res = await fetch('https://all-payments-api-production.up.railway.app/api/pesapal/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    if (!res.ok) {
      setLoading(false);
      alert(`HTTP error! status: ${res.status}`);
      return;
    }
    
    const myData = await res.json();
    console.log('Payment Response:', myData);
    
    // Store order tracking ID for polling
    if (myData.order_tracking_id) {
      setOrderTrackingId(myData.order_tracking_id);
    }
    
    alert("Payment Initialized");

    // Open the payment modal with the redirect URL
    openPaymentModal(myData.redirect_url, myData.order_tracking_id);
    setLoading(false);
    
  } catch (err) {
    setLoading(false);
    alert('Error: ' + err.message);
  }
};

// Function to check payment status (export this if needed elsewhere)
const checkPaymentStatus = async (orderTrackingId, handleUpgrade, stopPolling) => {
  const paymentData = {
    orderTrackingId,
    consumerKey: "nbZBtDnSEt9X+l0cHNDFren+7dTQIJXl",
    consumerSecret: "3p2NhatNMO64hzQpqGUs062LTvE="
  };

  try {
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
    
    const status = data.payment_status_description || '';
    const statusCode = data.status_code;
    
    // COMPLETED - Payment successful
    if (status === 'COMPLETED' || statusCode === 1) {
      stopPolling();
      await handleUpgrade();
      return { completed: true, status: 'success' };
    } 
    // FAILED - Payment failed
    else if (status === 'FAILED' || statusCode === 2) {
      stopPolling();
      return { completed: false, status: 'failed' };
    }
    // REVERSED - Payment was reversed
    else if (status === 'REVERSED' || statusCode === 3) {
      stopPolling();
      return { completed: false, status: 'reversed' };
    }
    // INVALID - Payment not yet processed (this is normal when payment just started)
    else if (status === 'INVALID' || statusCode === 0) {
      // Don't stop polling, just return pending
      return { completed: false, status: 'pending' };
    }
    
    return { completed: false, status: 'pending' };
  } catch (err) {
    console.error('Error checking payment status:', err);
    return { completed: false, status: 'error', error: err.message };
  }
};

export default function PesapalPayments({ setUserData }) {
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [orderTrackingId, setOrderTrackingId] = useState(null);
  const { price, setPrice } = useContext(PriceContext);
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const returnPeriod = () => {
    if (price === 250) {
      return 'Daily';
    } else if (price === 800) {
      return 'Weekly';
    } else if (price === 3000) {
      return 'Monthly';
    } else if (price === 8000) {
      return 'Yearly';
    } else {
      return 'Daily';
    }
  };

  const handleUpgrade = async () => {
    try {
      const currentDate = new Date().toISOString();

      const userDocRef = doc(db, "users", currentUser.email);
      await setDoc(userDocRef, {
        email: currentUser.email,
        username: currentUser.email,
        isPremium: true,
        subscription: returnPeriod(),
        subDate: currentDate
      }, { merge: true }).then(async (response) => {
        alert('You Have Upgraded To ' + returnPeriod() + " VIP");
      }).then(async () => {
        await getUser(currentUser.email, setUserData);
      }).then(async () => {
        navigate('/');
      }).catch(async (error) => {
        const errorMessage = await error.message;
        alert(errorMessage);
      });
    } catch (error) {
      console.error("Error upgrading user:", error.message);
      alert("Error upgrading user: " + error.message);
    }
  };

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

  const handlePayClick = async () => {
    if (!currentUser) {
      alert('Please login first');
      return;
    }

    const description = `${returnPeriod()} VIP Subscription`;
    const redirectPath = '/payment-success';
    
    await handlePayment(
      price,
      currentUser.email,
      description,
      redirectPath,
      setLoading,
      (msg) => alert(msg),
      openPaymentModal,
      handleUpgrade,
      setOrderTrackingId
    );
  };

  // Handle callback from Pesapal (when redirected back to your site)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingId = urlParams.get('OrderTrackingId');
    const merchantRef = urlParams.get('OrderMerchantReference');
    const notificationType = urlParams.get('OrderNotificationType');
    
    if (trackingId && notificationType === 'CALLBACKURL' && !polling) {
      // User was redirected back from Pesapal
      setLoading(true);
      
      // Check payment status immediately
      checkPaymentStatus(trackingId, handleUpgrade, () => {
        setLoading(false);
      });
    }
  }, []);

  return (
    <div className="pay">
      <AppHelmet title={"Pay"} location={'/pay'} />
      
      {(loading || polling) && <Loader />}

      <form>
        <fieldset>
          <input 
            name="prices" 
            type="radio" 
            value={250} 
            id="daily" 
            checked={price === 250} 
            onChange={(e) => setPrice(250)} 
          />
          <label htmlFor="daily">Daily VIP</label>
          <span className="price">KSH 250</span>
        </fieldset>
        <fieldset>
          <input 
            name="prices" 
            type="radio" 
            value={800} 
            id="weekly" 
            checked={price === 800} 
            onChange={(e) => setPrice(800)} 
          />
          <label htmlFor="weekly">7 Days VIP</label>
          <span className="price">KSH 800</span>
        </fieldset>
        <fieldset>
          <input 
            name="prices" 
            type="radio" 
            value={3000} 
            id="monthly" 
            checked={price === 3000} 
            onChange={(e) => setPrice(3000)} 
          />
          <label htmlFor="monthly">30 Days VIP</label>
          <span className="price">KSH 3000</span>
        </fieldset>
        <fieldset>
          <input 
            name="prices" 
            type="radio" 
            value={8000} 
            id="yearly" 
            checked={price === 8000} 
            onChange={(e) => setPrice(8000)} 
          />
          <label htmlFor="yearly">1 Year VIP</label>
          <span className="price">KSH 8000</span>
        </fieldset>
      </form>
      
      <h4>GET {returnPeriod().toUpperCase()} VIP FOR {price}</h4>
      
      <button className='btn' onClick={handlePayClick} disabled={loading || polling}>
        {loading ? 'PROCESSING...' : polling ? 'CHECKING PAYMENT...' : 'PAY NOW WITH PESAPAL'}
      </button>
    </div>
  );
}

// Add this CSS to your Ticket.scss file
const additionalStyles = `
.swal2-popup {
  padding: 0 !important;
}

.swal2-title {
  padding: 1rem !important;
  margin: 0 !important;
}

.payment-modal-popup {
  height: 600px !important;
  max-width: 900px !important;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Payment status indicator */
#payment-status {
  font-size: 12px;
  background: #007bff !important;
  color: white !important;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}
`;

// Add styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = additionalStyles;
  document.head.appendChild(style);
}