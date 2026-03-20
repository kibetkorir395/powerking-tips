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
        timerProgressBar: true
      });
      return;
    }
    
    const myData = await res.json();
    console.log('Payment Response:', myData);
    
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
      timerProgressBar: true
    });

    // Open the payment modal with the redirect URL
    setTimeout(() => {
      openPaymentModal(myData.redirect_url, myData.order_tracking_id);
    }, 2000);
    
    setProcessing(false);
    
  } catch (err) {
    setProcessing(false);
    Swal.fire({
      icon: 'error',
      title: 'Oops...',
      text: 'Error: ' + err.message,
      confirmButtonColor: '#d33',
      confirmButtonText: 'OK',
      footer: '<a href="https://pesapal.com/support">Need help?</a>'
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
          timerProgressBar: true
        });
      }).then(async () => {
        await getUser(currentUser.email, setUserData);
      }).then(async () => {
        navigate('/');
      }).catch(async (error) => {
        const errorMessage = await error.message;
        Swal.fire({
          icon: 'error',
          title: 'Upgrade Failed',
          text: errorMessage,
          confirmButtonColor: '#d33'
        });
      });
    } catch (error) {
      console.error("Error upgrading user:", error.message);
      Swal.fire({
        icon: 'error',
        title: 'System Error',
        text: "Error upgrading user: " + error.message,
        confirmButtonColor: '#d33'
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
      // INVALID - Payment not yet processed
      else if (status === 'INVALID' || statusCode === 0) {
        return { completed: false, status: 'pending' };
      }
      
      return { completed: false, status: 'pending' };
    } catch (err) {
      console.error('Error checking payment status:', err);
      return { completed: false, status: 'error', error: err.message };
    }
  };

  // Function to open the payment modal with SweetAlert2
  const openPaymentModal = (paymentUrl, trackingId) => {
    let pollInterval;
    let pollCount = 0;
    const MAX_POLLS = 60;
    
    // Close any existing Swal instances
    Swal.close();
    
    Swal.fire({
      title: 'Complete Your Payment',
      html: `
        <div style="width: 100%; height: 500px; overflow: hidden;">
          <iframe 
            src="${paymentUrl}" 
            style="width: 100%; height: 100%; border: none;"
            title="Pesapal Payment"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-top-navigation-by-user-activation"
            allow="payment *;"
          ></iframe>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      width: '800px',
      customClass: {
        popup: 'payment-modal-popup'
      },
      didOpen: () => {
        console.log('Payment modal opened with URL:', paymentUrl);

        // Start polling after 20 seconds
        setTimeout(() => {
          setPolling(true);
          console.log('Started polling for tracking ID:', trackingId);
          
          pollInterval = setInterval(async () => {
            pollCount++;
            console.log(`Polling payment status (${pollCount}/${MAX_POLLS}) for:`, trackingId);
            
            try {
              const result = await checkPaymentStatus(
                trackingId, 
                handleUpgrade, 
                () => {
                  if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                  }
                  setPolling(false);
                  Swal.close();
                }
              );
              
              if (result.completed && result.status === 'success') {
                console.log('Payment completed successfully!');
                if (pollInterval) {
                  clearInterval(pollInterval);
                  pollInterval = null;
                }
                setPolling(false);
                Swal.close();
              } else if (result.status === 'failed') {
                console.log('Payment failed');
                if (pollInterval) {
                  clearInterval(pollInterval);
                  pollInterval = null;
                }
                setPolling(false);
                Swal.close();
                Swal.fire({
                  icon: 'error',
                  title: 'Payment Failed',
                  text: 'Your payment could not be processed. Please try again or use a different payment method.',
                  confirmButtonColor: '#d33',
                  confirmButtonText: 'Try Again'
                });
              } else if (result.status === 'reversed') {
                console.log('Payment reversed');
                if (pollInterval) {
                  clearInterval(pollInterval);
                  pollInterval = null;
                }
                setPolling(false);
                Swal.close();
                Swal.fire({
                  icon: 'warning',
                  title: 'Payment Reversed',
                  text: 'Your payment was reversed. Please contact support for assistance.',
                  confirmButtonColor: '#ffc107',
                  confirmButtonText: 'Contact Support'
                });
              }
              
              // Stop polling after maximum attempts
              if (pollCount >= MAX_POLLS) {
                console.log('Max polling attempts reached');
                if (pollInterval) {
                  clearInterval(pollInterval);
                  pollInterval = null;
                }
                setPolling(false);
                Swal.close();
                Swal.fire({
                  icon: 'warning',
                  title: 'Payment Status Timeout',
                  html: `
                    <div style="text-align: center;">
                      <p>We're still waiting for payment confirmation.</p>
                      <p>Please check your email for payment receipt.</p>
                      <button onclick="window.location.reload()" style="background: #3085d6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                        Refresh Page
                      </button>
                    </div>
                  `,
                  showConfirmButton: false,
                  showCloseButton: true
                });
              }
            } catch (err) {
              console.error('Error in polling:', err);
            }
          }, 5000);
        }, 20000);
      },
      willClose: () => {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        setPolling(false);
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
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/login');
        }
      });
      return;
    }

    const result = await Swal.fire({
      icon: 'question',
      title: 'Confirm Payment',
      html: `
        <div style="text-align: left; padding: 10px;">
          <p style="margin: 5px 0;"><strong>Plan:</strong> ${returnPeriod()} VIP</p>
          <p style="margin: 5px 0;"><strong>Amount:</strong> KSH ${price}</p>
          <p style="margin: 5px 0;"><strong>Duration:</strong> ${returnPeriod()}</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#4CAF50',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, proceed',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      const description = `${returnPeriod()} VIP Subscription`;
      const redirectPath = '/payment-success';
      
      await handlePayment(
        price,
        currentUser.email,
        description,
        redirectPath,
        setProcessing,
        (msg) => alert(msg),
        openPaymentModal,
        handleUpgrade,
        setOrderTrackingId
      );
    }
  };

  // Handle callback from Pesapal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingId = urlParams.get('OrderTrackingId');
    const notificationType = urlParams.get('OrderNotificationType');
    
    if (trackingId && notificationType === 'CALLBACKURL' && !polling) {
      setProcessing(true);
      
      Swal.fire({
        icon: 'info',
        title: 'Verifying Payment',
        text: 'Please wait while we confirm your payment...',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      checkPaymentStatus(trackingId, handleUpgrade, () => {
        setProcessing(false);
        Swal.close();
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
      
      <h4>GET {returnPeriod().toUpperCase()} VIP FOR KSH {price}</h4>
      
      <button className='btn' onClick={handlePayClick} disabled={processing || polling}>
        {processing ? (
          <span><i className="fas fa-spinner fa-spin"></i> PROCESSING...</span>
        ) : polling ? (
          <span><i className="fas fa-clock"></i> CHECKING PAYMENT...</span>
        ) : (
          <span><i className="fas fa-lock"></i> PAY NOW WITH PESAPAL</span>
        )}
      </button>
    </div>
  );
}

// Add styles
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
  padding: 14px 28px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  margin-top: 20px;
}

.btn i {
  margin-right: 8px;
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  background: linear-gradient(135deg, #a0a0a0 0%, #808080 100%);
  transform: none !important;
  box-shadow: none;
}

.btn:not(:disabled):hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.fa-spinner {
  animation: spin 1s linear infinite;
}

.price {
  font-weight: 600;
  color: #4CAF50;
  margin-left: 10px;
}

fieldset {
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  padding: 15px;
  margin: 10px 0;
  transition: all 0.3s ease;
  cursor: pointer;
}

fieldset:hover {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

input[type="radio"] {
  margin-right: 10px;
  transform: scale(1.2);
  cursor: pointer;
}

label {
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

h4 {
  text-align: center;
  color: #333;
  margin: 20px 0;
  font-size: 20px;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const existingStyle = document.getElementById('pesapal-payment-styles');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  const style = document.createElement('style');
  style.id = 'pesapal-payment-styles';
  style.textContent = additionalStyles;
  document.head.appendChild(style);
}
