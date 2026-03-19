import React, { useContext, useState, useEffect } from 'react';
import './Ticket.scss';
import { PriceContext } from '../../PriceContext';
import AppHelmet from '../../components/AppHelmet';
import { AuthContext } from '../../AuthContext';
import { db, getUser } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { 
  requestPesapalToken, 
  registerIpn, 
  submitOrder,
  checkTransactionStatus 
} from '../../utils/pesapal';

export default function PesapalPayments({ setUserData }) {
  const { price, setPrice } = useContext(PriceContext);
  const { currentUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [bearerToken, setBearerToken] = useState(null);
  const [ipnId, setIpnId] = useState(null);

  // Format phone number for display
  const formatPhoneDisplay = (phone) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('254')) {
      return '0' + digits.substring(3);
    }
    return digits;
  };

  // Initialize Pesapal on component mount
  useEffect(() => {
    const initializePesapal = async () => {
      try {
        const token = await requestPesapalToken();
        if (token) {
          setBearerToken(token);
          
          // Register IPN URL - using window.location.origin for the IPN endpoint
          // Since you don't want to add backend endpoints, we'll use a dummy URL that points to the current page
          // Pesapal will still send notifications here, but they won't be processed without a backend
          const ipnUrl = window.location.origin + '/pesapal-ipn';
          const ipn = await registerIpn(token, ipnUrl);
          if (ipn) {
            setIpnId(ipn);
          }
        }
      } catch (error) {
        console.error('Failed to initialize Pesapal:', error);
      }
    };

    initializePesapal();
  }, []);

  const handleUpgrade = async () => {
    try {
      const userDocRef = doc(db, "users", currentUser.email);
      await setDoc(
        userDocRef,
        {
          email: currentUser.email,
          username: currentUser.email,
          isPremium: true,
          subscription: returnPeriod(),
          subDate: new Date().toISOString(),
        },
        { merge: true }
      );
      await getUser(currentUser.email, setUserData);
      
      Swal.fire({
        title: "Success! 🎉",
        text: `You Have Upgraded To ${returnPeriod()} VIP`,
        icon: "success",
        confirmButtonText: "Continue"
      }).then(() => {
        window.location.pathname = '/';
      });
    } catch (error) {
      Swal.fire({
        title: "Error",
        text: error.message,
        icon: "error",
        confirmButtonText: "OK"
      });
    }
  };

  const returnPeriod = () => {
    if (price === 250) return 'Daily';
    if (price === 800) return 'Weekly';
    if (price === 3000) return 'Monthly';
    return 'Yearly';
  };

  // Poll transaction status
  const pollTransactionStatus = (orderTrackingId) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 5 seconds = 2.5 minutes max
    let pollInterval;

    const checkStatus = async () => {
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        Swal.fire({
          title: "Payment Timeout",
          text: "⏰ Payment monitoring timeout. Please check your transaction history.",
          icon: "warning",
          confirmButtonText: "OK",
        });
        return;
      }

      attempts++;

      try {
        const statusData = await checkTransactionStatus(orderTrackingId);
        
        if (statusData && (statusData.status === 'COMPLETED' || statusData.payment_status_description === 'Completed')) {
          clearInterval(pollInterval);
          Swal.fire({
            title: "Payment Successful! 🎉",
            html: `
              <div style="text-align: center;">
                <i class="fas fa-check-circle" style="font-size: 48px; color: #10b981;"></i>
                <h3 style="margin: 15px 0; color: #10b981;">Payment Completed</h3>
                <p>Your VIP subscription has been activated.</p>
                <p style="font-size: 0.8rem; color: #888;">Payment confirmed</p>
              </div>
            `,
            icon: "success",
            confirmButtonText: "Continue",
          }).then(() => {
            handleUpgrade();
          });
          return;
        }
        
        if (statusData && (statusData.status === 'FAILED' || statusData.payment_status_description === 'Failed')) {
          clearInterval(pollInterval);
          Swal.fire({
            title: "Payment Failed",
            text: "❌ The payment was not completed. Please try again.",
            icon: "error",
            confirmButtonText: "OK",
          });
          return;
        }
      } catch (error) {
        console.log('Polling attempt', attempts, 'continuing...');
      }
    };

    pollInterval = setInterval(checkStatus, 5000);
    return pollInterval;
  };

  // Handle payment with Pesapal
  const handlePay = async () => {
    if (!currentUser?.email) {
      Swal.fire({
        title: "Error",
        text: "Please log in to continue",
        icon: "error",
        confirmButtonText: "OK"
      });
      return;
    }

    if (!bearerToken || !ipnId) {
      Swal.fire({
        title: "Initializing...",
        text: "Please wait while we initialize payment system",
        icon: "info",
        timer: 1500,
        showConfirmButton: false
      });
      
      // Try to initialize again
      const token = await requestPesapalToken();
      if (token) {
        setBearerToken(token);
        const ipn = await registerIpn(token, window.location.origin + '/pesapal-ipn');
        if (ipn) {
          setIpnId(ipn);
        } else {
          Swal.fire({
            title: "Error",
            text: "Failed to initialize payment system. Please try again.",
            icon: "error",
            confirmButtonText: "OK"
          });
          return;
        }
      } else {
        Swal.fire({
          title: "Error",
          text: "Failed to initialize payment system. Please try again.",
          icon: "error",
          confirmButtonText: "OK"
        });
        return;
      }
    }

    // Show phone number input modal
    const { value: phoneNumber } = await Swal.fire({
      title: "Enter M-Pesa Phone Number",
      html: `
        <div style="text-align: center; margin-bottom: 15px;">
          <i class="fas fa-mobile-alt" style="font-size: 48px; color: #065f46;"></i>
        </div>
        <p style="margin-bottom: 15px;">Enter the M-Pesa phone number to receive the payment prompt.</p>
        <p style="font-size: 0.8rem; color: #666;">You can enter in any format:<br>07XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX, 01XXXXXXXX, etc.</p>
      `,
      input: "tel",
      inputPlaceholder: "e.g., 0797814027",
      showCancelButton: true,
      confirmButtonText: "Continue",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#006600",
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
      inputValidator: (value) => {
        if (!value) return "Phone number is required!";
        const digits = value.replace(/\D/g, "");
        if (digits.length < 9) return "Please enter a valid phone number";
        return null;
      }
    });

    if (!phoneNumber) return; // User cancelled

    setLoading(true);

    try {
      // Format phone number for display in modal
      const displayPhone = formatPhoneDisplay(phoneNumber);
      const callbackUrl = window.location.origin + '/payment-callback'; // This will just be a page that shows "Processing payment"

      // Show loading
      Swal.fire({
        title: "Initiating Payment",
        text: "Connecting to Pesapal...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // Submit order to Pesapal
      const orderData = await submitOrder({
        bearerToken,
        ipnId,
        amount: price,
        email: currentUser.email,
        callbackUrl,
        description: `${returnPeriod()} VIP Subscription`
      });

      Swal.close();

      if (orderData && orderData.order_tracking_id) {
        // Show STK push instructions
        Swal.fire({
          title: "Check Your Phone",
          html: `
            <div style="text-align: center;">
              <i class="fas fa-mobile-alt" style="font-size: 48px; color: #065f46;"></i>
              <h3 style="margin: 15px 0;">Enter M-Pesa PIN</h3>
              <p>Check your phone to authorize payment of <strong>KSH ${price}</strong></p>
              <p><small>Phone: ${displayPhone}</small></p>
              <p style="color: #666; font-size: 0.9rem; margin-top: 15px;">
                ✅ Payment request sent. Please check your phone and enter your M-Pesa PIN.
              </p>
              <p style="font-size: 0.8rem; color: #888; margin-top: 10px;">
                Tracking ID: ${orderData.order_tracking_id}
              </p>
            </div>
          `,
          icon: "info",
          confirmButtonText: "I've Completed Payment",
          showCancelButton: true,
          cancelButtonText: "Cancel",
        }).then((result) => {
          if (result.isConfirmed) {
            // Start polling for transaction status
            Swal.fire({
              title: "Verifying Payment",
              text: "Please wait while we confirm your payment...",
              allowOutsideClick: false,
              didOpen: () => {
                Swal.showLoading();
                pollTransactionStatus(orderData.order_tracking_id);
              }
            });
          }
        });
      } else {
        throw new Error("Failed to create order");
      }
    } catch (error) {
      console.error("Payment error:", error);
      Swal.fire({
        title: "Payment Failed",
        text: error.message || "Unable to process payment. Please try again.",
        icon: "error",
        confirmButtonText: "Try Again",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pay">
      <AppHelmet title={"Pay"} location={'/pay'} />
      
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}

      <form>
        <fieldset>
          <input 
            name="prices" 
            type="radio" 
            value={250} 
            id="daily" 
            checked={price === 250} 
            onChange={(e) => setPrice(parseInt(e.target.value))} 
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
            onChange={(e) => setPrice(parseInt(e.target.value))} 
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
            onChange={(e) => setPrice(parseInt(e.target.value))} 
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
            onChange={(e) => setPrice(parseInt(e.target.value))} 
          />
          <label htmlFor="yearly">1 Year VIP</label>
          <span className="price">KSH 8000</span>
        </fieldset>
      </form>
      
      <h4>GET {returnPeriod().toUpperCase()} VIP FOR KSH {price}</h4>
      
      <button 
        onClick={handlePay} 
        className="btn"
        disabled={loading}
      >
        {loading ? 'Processing...' : 'Pay Now'}
      </button>
    </div>
  );
}