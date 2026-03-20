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
      await Swal.fire({
        icon: 'error',
        title: 'Payment Initialization Failed',
        text: `HTTP error! status: ${res.status}`,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Try Again',
        timer: 5000,
        timerProgressBar: true,
        customClass: {
          popup: 'swal-custom-popup',
          title: 'swal-custom-title',
          htmlContainer: 'swal-custom-html',
          confirmButton: 'swal-custom-confirm'
        }
      });
      return;
    }
    
    const myData = await res.json();
    
    // Store order tracking ID for polling
    if (myData.order_tracking_id) {
      setOrderTrackingId(myData.order_tracking_id);
    }
    
    // Show success alert and wait for it to close before opening modal
    await Swal.fire({
      icon: 'success',
      title: 'Payment Initialized!',
      text: 'Redirecting you to payment gateway...',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
      customClass: {
        popup: 'swal-custom-popup',
        title: 'swal-custom-title',
        htmlContainer: 'swal-custom-html'
      },
      didClose: () => {
        // Small extra delay to ensure cleanup
        setTimeout(() => {
          openPaymentModal(myData.redirect_url, myData.order_tracking_id);
        }, 100);
      }
    });
    
    setProcessing(false);
    
  } catch (err) {
    setProcessing(false);
    await Swal.fire({
      icon: 'error',
      title: 'Oops...',
      text: 'Error: ' + err.message,
      confirmButtonColor: '#d33',
      confirmButtonText: 'OK',
      footer: '<a href="https://pesapal.com/support" style="color: #3085d6; text-decoration: none;">Need help?</a>',
      customClass: {
        popup: 'swal-custom-popup',
        title: 'swal-custom-title',
        htmlContainer: 'swal-custom-html',
        confirmButton: 'swal-custom-confirm',
        footer: 'swal-custom-footer'
      }
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
            <div style="text-align: center; font-family: inherit;">
              <h3 style="color: #4CAF50; margin-bottom: 15px; font-size: 20px; font-weight: 600;">You've Been Upgraded!</h3>
              <p style="font-size: 16px; margin: 8px 0; color: #333;">You are now a <strong style="color: #4CAF50;">${returnPeriod()}</strong> VIP member</p>
              <p style="font-size: 14px; color: #666; margin-top: 10px;">Enjoy exclusive tips and premium content</p>
            </div>
          `,
          showConfirmButton: true,
          confirmButtonColor: '#4CAF50',
          confirmButtonText: 'Start Exploring!',
          timer: 5000,
          timerProgressBar: true,
          backdrop: 'rgba(0,0,0,0.4)',
          customClass: {
            popup: 'swal-custom-popup',
            title: 'swal-custom-title',
            htmlContainer: 'swal-custom-html',
            confirmButton: 'swal-custom-confirm-success'
          }
        });
      })
      .then(async () => {
        await getUser(currentUser.email, setUserData);
      })
      .then(async () => {
        navigate('/');
      }).catch(async (error) => {
        const errorMessage = await error.message;
        await Swal.fire({
          icon: 'error',
          title: 'Upgrade Failed',
          text: errorMessage,
          confirmButtonColor: '#d33',
          customClass: {
            popup: 'swal-custom-popup',
            title: 'swal-custom-title',
            htmlContainer: 'swal-custom-html',
            confirmButton: 'swal-custom-confirm'
          }
        });
      });
    } catch (error) {
      console.error("Error upgrading user:", error.message);
      await Swal.fire({
        icon: 'error',
        title: 'System Error',
        text: 'Error upgrading user: ' + error.message,
        confirmButtonColor: '#d33',
        customClass: {
          popup: 'swal-custom-popup',
          title: 'swal-custom-title',
          htmlContainer: 'swal-custom-html',
          confirmButton: 'swal-custom-confirm'
        }
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
                
                // Small delay before showing error alert
                setTimeout(async () => {
                  await Swal.fire({
                    icon: 'error',
                    title: 'Payment Failed',
                    text: 'Your payment could not be processed. Please try again or use a different payment method.',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Try Again',
                    footer: '<a href="https://pesapal.com/support" style="color: #3085d6; text-decoration: none;">Contact Support</a>',
                    customClass: {
                      popup: 'swal-custom-popup',
                      title: 'swal-custom-title',
                      htmlContainer: 'swal-custom-html',
                      confirmButton: 'swal-custom-confirm',
                      footer: 'swal-custom-footer'
                    }
                  });
                }, 300);
              }
              
              // Stop polling after maximum attempts
              if (pollCount >= MAX_POLLS) {
                clearInterval(pollInterval);
                setPolling(false);
                Swal.close();
                
                // Small delay before showing timeout alert
                setTimeout(async () => {
                  await Swal.fire({
                    icon: 'warning',
                    title: 'Payment Status Timeout',
                    html: `
                      <div style="text-align: center;">
                        <p style="margin-bottom: 10px; color: #333;">We're still waiting for payment confirmation.</p>
                        <p style="margin-bottom: 15px; color: #666;">Please check your email for payment receipt or</p>
                        <button onclick="window.location.reload()" style="background: #3085d6; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">
                          Refresh Page
                        </button>
                      </div>
                    `,
                    showConfirmButton: false,
                    showCloseButton: true,
                    customClass: {
                      popup: 'swal-custom-popup',
                      title: 'swal-custom-title',
                      htmlContainer: 'swal-custom-html',
                      closeButton: 'swal-custom-close'
                    }
                  });
                }, 300);
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
      await Swal.fire({
        icon: 'warning',
        title: 'Login Required',
        text: 'Please login first to continue with payment',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Login Now',
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        customClass: {
          popup: 'swal-custom-popup',
          title: 'swal-custom-title',
          htmlContainer: 'swal-custom-html',
          confirmButton: 'swal-custom-confirm-blue',
          cancelButton: 'swal-custom-cancel'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/login');
        }
      });
      return;
    }

    // Show confirmation dialog before proceeding
    const result = await Swal.fire({
      icon: 'question',
      title: 'Confirm Payment',
      html: `
        <div style="text-align: left; padding: 5px;">
          <p style="margin: 8px 0; font-size: 15px;"><strong style="color: #333;">Plan:</strong> <span style="color: #4CAF50; font-weight: 600;">${returnPeriod()} VIP</span></p>
          <p style="margin: 8px 0; font-size: 15px;"><strong style="color: #333;">Amount:</strong> <span style="color: #4CAF50; font-weight: 600;">KSH ${price}</span></p>
          <p style="margin: 8px 0; font-size: 15px;"><strong style="color: #333;">Duration:</strong> <span style="color: #4CAF50; font-weight: 600;">${returnPeriod()}</span></p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#4CAF50',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, proceed',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'swal-custom-popup',
        title: 'swal-custom-title',
        htmlContainer: 'swal-custom-html',
        confirmButton: 'swal-custom-confirm-success',
        cancelButton: 'swal-custom-cancel'
      }
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

  // Handle callback from Pesapal (when redirected back to your site)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingId = urlParams.get('OrderTrackingId');
    const merchantRef = urlParams.get('OrderMerchantReference');
    const notificationType = urlParams.get('OrderNotificationType');
    
    if (trackingId && notificationType === 'CALLBACKURL' && !polling) {
      // User was redirected back from Pesapal
      setProcessing(true);
      
      // Show loading indicator
      Swal.fire({
        title: 'Verifying Payment',
        text: 'Please wait while we confirm your payment...',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
        customClass: {
          popup: 'swal-custom-popup',
          title: 'swal-custom-title',
          htmlContainer: 'swal-custom-html'
        }
      });
      
      // Check payment status immediately
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

// Add this CSS to your Ticket.scss file
const additionalStyles = `
/* Payment Modal Specific Styles - No padding */
.payment-modal-popup {
  height: 600px !important;
  max-width: 900px !important;
  padding: 0 !important;
}

/* SweetAlert Custom Styles for all other dialogs */
.swal-custom-popup {
  border-radius: 15px !important;
  padding: 20px !important;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2) !important;
}

.swal-custom-title {
  font-size: 22px !important;
  font-weight: 600 !important;
  color: #333 !important;
  margin-top: 5px !important;
}

.swal-custom-html {
  font-size: 15px !important;
  color: #555 !important;
  margin: 10px 0 !important;
}

.swal-custom-confirm {
  background-color: #d33 !important;
  border-radius: 8px !important;
  padding: 10px 25px !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  box-shadow: 0 4px 10px rgba(211, 51, 51, 0.3) !important;
}

.swal-custom-confirm-success {
  background-color: #4CAF50 !important;
  border-radius: 8px !important;
  padding: 10px 25px !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  box-shadow: 0 4px 10px rgba(76, 175, 80, 0.3) !important;
}

.swal-custom-confirm-blue {
  background-color: #3085d6 !important;
  border-radius: 8px !important;
  padding: 10px 25px !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  box-shadow: 0 4px 10px rgba(48, 133, 214, 0.3) !important;
}

.swal-custom-cancel {
  background-color: #d33 !important;
  border-radius: 8px !important;
  padding: 10px 25px !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  margin-left: 10px !important;
}

.swal-custom-footer {
  margin-top: 15px !important;
  padding-top: 10px !important;
  border-top: 1px solid #eee !important;
}

.swal-custom-close {
  color: #999 !important;
  font-size: 24px !important;
}

/* Button styles */
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
  width: 100%;
  max-width: 300px;
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

/* Form styles */
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

/* Override SweetAlert2 default styles for payment modal only */
.swal2-popup.payment-modal-popup {
  padding: 0 !important;
}

.swal2-popup.payment-modal-popup .swal2-title {
  padding: 1rem !important;
  margin: 0 !important;
}
`;

// Add styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = additionalStyles;
  document.head.appendChild(style);
}
