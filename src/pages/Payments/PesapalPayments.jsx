// PesapalPayments.jsx
import React, { useContext, useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import './Ticket.scss';
import { PriceContext } from '../../PriceContext';
import AppHelmet from '../../components/AppHelmet';
import { AuthContext } from '../../AuthContext';
import { db, getUser, updateUser } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

// Payment handling functions
const handlePayment = async (
  amount, 
  email, 
  description, 
  redirectPath, 
  setProcessing, 
  setNotification, 
  openPaymentModal,
  handleUpgrade,
  setOrderTrackingId
) => {
  const paymentData = {
    amount: amount,
    email,
    description,
    countryCode: "KE",
    currency: "KES",
    url: window.location.origin + window.location.pathname,
    callbackUrl: window.location.origin + redirectPath,
    consumerKey: "nbZBtDnSEt9X+l0cHNDFren+7dTQIJXl",
    consumerSecret: "3p2NhatNMO64hzQpqGUs062LTvE="
  };

  setProcessing(true);
  try {
    const res = await fetch('https://all-payments-api-production.up.railway.app/api/pesapal/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    if (!res.ok) {
      setProcessing(false);
      Swal.fire({
        icon: 'error',
        title: 'Payment Initialization Failed',
        text: `HTTP error! status: ${res.status}`,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Try Again',
        timer: 5000,
        timerProgressBar: true,
      });
      return;
    }
    
    const myData = await res.json();
    
    // Store order tracking ID for polling
    if (myData.order_tracking_id) {
      setOrderTrackingId(myData.order_tracking_id);
    }
    
    Swal.fire({
      icon: 'success',
      title: 'Payment Initialized!',
      text: 'Redirecting you to payment gateway...',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
    });

    // Open the payment modal with the redirect URL
    openPaymentModal(myData.redirect_url, myData.order_tracking_id);
    setProcessing(false);
    
  } catch (err) {
    setProcessing(false);
    Swal.fire({
      icon: 'error',
      title: 'Oops...',
      text: 'Error: ' + err.message,
      confirmButtonColor: '#d33',
      confirmButtonText: 'OK',
      footer: '<a href="https://pesapal.com/support">Need help?</a>',
    });
  }
};

export default function PesapalPayments({ setUserData }) {
  const [processing, setProcessing] = useState(false);
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
        await Swal.fire({
            icon: 'success',
            title: '🎉 Welcome to VIP!',
            html: `
            <div style="text-align: center;">
              <h3 style="color: #4CAF50; margin-bottom: 10px;">You've Been Upgraded!</h3>
              <p style="font-size: 16px; margin: 5px 0;">You are now a <strong>${returnPeriod()}</strong> VIP member</p>
              <p style="font-size: 14px; color: #666;">Enjoy exclusive tips and premium content</p>
            </div>
          `,
            showConfirmButton: true,
            confirmButtonColor: '#4CAF50',
            confirmButtonText: 'Start Exploring!',
            timer: 5000,
            timerProgressBar: true,
            backdrop: `
            rgba(0,0,0,0.4)
            left top
            no-repeat
          `,
          });
        })
        .then(async () => {
          await getUser(currentUser.email, setUserData);
        })
        .then(async () => {
          navigate('/');
        }).catch(async (error) => {
        const errorMessage = await error.message;
        Swal.fire({
            icon: 'error',
            title: 'Upgrade Failed',
            text: errorMessage,
            confirmButtonColor: '#d33',
          });
      });
    } catch (error) {
      console.error("Error upgrading user:", error.message);
      Swal.fire({
        icon: 'error',
        title: 'System Error',
        text: 'Error upgrading user: ' + error.message,
        confirmButtonColor: '#d33',
      });
    }
  };

  // Function to check payment status
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
      return { completed: false, status: 'error', error: err.message };
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
          
          pollInterval = setInterval(async () => {
            pollCount++;
            console.log(`Polling payment status (${pollCount}/${MAX_POLLS}) for:`, trackingId);
            
            try {
              const result = await checkPaymentStatus(
                trackingId, 
                handleUpgrade, 
                () => {
                  clearInterval(pollInterval);
                  setPolling(false);
                  Swal.close();
                }
              );
              
              if (result.completed && result.status === 'success') {
                clearInterval(pollInterval);
                setPolling(false);
                Swal.close();
              } else if (result.status === 'failed' || result.status === 'reversed') {
                clearInterval(pollInterval);
                setPolling(false);
                Swal.close();
                Swal.fire({
                  icon: 'error',
                  title: 'Payment Failed',
                  text: 'Your payment could not be processed. Please try again or use a different payment method.',
                  confirmButtonColor: '#d33',
                  confirmButtonText: 'Try Again',
                  footer:
                    '<a href="https://pesapal.com/support">Contact Support</a>',
                });
              }
              
              // Stop polling after maximum attempts
              if (pollCount >= MAX_POLLS) {
                clearInterval(pollInterval);
                setPolling(false);
                Swal.close();
                Swal.fire({
                  icon: 'warning',
                  title: 'Payment Status Timeout',
                  html: `
                    <p>We're still waiting for payment confirmation.</p>
                    <p>Please check your email for payment receipt or <a href="#" onclick="window.location.reload()">try refreshing</a>.</p>
                  `,
                  confirmButtonColor: '#3085d6',
                  confirmButtonText: 'Check Email',
                  showCancelButton: true,
                  cancelButtonText: 'Close',
                });
                
              }
            } catch (err) {
              console.error('Error in polling:', err);
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
      Swal.fire({
        icon: 'warning',
        title: 'Login Required',
        text: 'Please login first to continue with payment',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Login Now',
        showCancelButton: true,
        cancelButtonText: 'Cancel',
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/login');
        }
      });
      return;
    }

    const description = `${returnPeriod()} VIP Subscription`;
    const redirectPath = '/payment-success';
    
    await handlePayment(
      price,
      currentUser.email,
      description,
      redirectPath,
      setProcessing, // Changed from setLoading to setProcessing
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
      setProcessing(true);
      
      // Check payment status immediately
      checkPaymentStatus(trackingId, handleUpgrade, () => {
        setProcessing(false);
      });
    }
  }, []);

  return (
    <div className="pay">
      <AppHelmet title={"Pay"} location={'/pay'} />
      
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
      
      <button className='btn' onClick={handlePayClick} disabled={processing || polling}>
        {processing ? 'PROCESSING...' : polling ? 'CHECKING PAYMENT...' : 'PAY NOW WITH PESAPAL'}
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

.btn {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: #cccccc;
}

/* Animation for button states */
.btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}
`;

// Add styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = additionalStyles;
  document.head.appendChild(style);
}
