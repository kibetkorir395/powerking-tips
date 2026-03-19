// PesapalPayments.jsx
import Swal from 'sweetalert2';
import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { notificationState, planState } from '../../recoil/atoms';
import { pricings } from '../../data';
import AppHelmet from '../AppHelmet';
import ScrollToTop from '../ScrollToTop';
import Loader from '../../components/Loader/Loader';
import './Pay.scss';

// Payment handling functions
export const handlePayment = async (
  amount, 
  email, 
  description, 
  redirectPath, 
  setLoading, 
  setNotification, 
  openPaymentModal // New callback to open the payment modal
) => {
  const paymentData = {
    amount,
    email,
    description,
    countryCode: "KE",
    currency: "USD",
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
      return setNotification({
        isVisible: true,
        type: 'error',
        message: `HTTP error! status: ${res.status}`,
      });
    }
    
    const myData = await res.json();
    
    setNotification({
      isVisible: true,
      type: 'success',
      message: "Payment Initialized",
    });

    // Open the payment modal with the redirect URL
    openPaymentModal(myData.redirect_url);
    setLoading(false);
    
  } catch (err) {
    setLoading(false);
    setNotification({
      isVisible: true,
      type: 'error',
      message: err.message,
    });
  }
};

export const trackPayment = async (
  orderTrackingId, 
  setNotification, 
  setStatusData, 
  setLoading, 
  callBackFunction = () => {}
) => {
  const paymentData = {
    orderTrackingId,
    consumerKey: "nbZBtDnSEt9X+l0cHNDFren+7dTQIJXl",
    consumerSecret: "3p2NhatNMO64hzQpqGUs062LTvE="
  };

  setLoading(true);
  try {
    const res = await fetch(`https://all-payments-api-production.up.railway.app/api/pesapal/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });
  
    if (!res.ok) {
      setLoading(false);
      return setNotification({
        isVisible: true,
        type: 'error',
        message: `HTTP error! status: ${res.status}`,
      });
    }
    
    const data = await res.json();
    setLoading(false);
    setStatusData(data);
    
    setNotification({
      isVisible: true,
      type: 'success',
      message: 'Payment status retrieved successfully!',
    });
    
    callBackFunction(data);
    
  } catch (err) {
    setLoading(false);
    setNotification({
      isVisible: true,
      type: 'error',
      message: 'An Error Occurred: ' + err.message,
    });
  }
};

// Main Payment Component
export default function PesapalPayments() {
  const [loading, setLoading] = useState(false);
  const [paymentType, setPaymentType] = useState("mpesa");
  const [data, setData] = useState(null);
  const location = useLocation();
  const setNotification = useSetRecoilState(notificationState);
  const plan = useRecoilValue(planState);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (location.state) {
      setData(location.state);
    } else {
      setData(pricings[0]);
    }
  }, [location]);

  // Function to open the payment modal with SweetAlert2
  const openPaymentModal = (paymentUrl) => {
    Swal.fire({
      title: 'Complete Your Payment',
      html: `
        <div style="width: 100%; height: 500px; overflow: hidden;">
          <iframe 
            src="${paymentUrl}" 
            style="width: 100%; height: 100%; border: none;"
            title="Pesapal Payment"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          ></iframe>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      width: '800px',
      customClass: {
        container: 'payment-modal-container',
        popup: 'payment-modal-popup',
      },
      didOpen: () => {
        // Add message event listener to handle payment completion
        const handlePaymentMessage = (event) => {
          // Verify the origin for security
          if (event.origin.includes('pesapal.com') || event.origin.includes('254liquors.com')) {
            if (event.data && event.data.status === 'completed') {
              Swal.close();
              setNotification({
                isVisible: true,
                type: 'success',
                message: 'Payment completed successfully!',
              });
              // Redirect to callback URL or handle success
              window.location.href = event.data.redirectUrl || '/tips';
            }
          }
        };

        window.addEventListener('message', handlePaymentMessage);

        // Store the event listener for cleanup
        Swal.getPopup().setAttribute('data-payment-listener', 'true');
      },
      willClose: () => {
        // Remove event listener when modal closes
        window.removeEventListener('message', (event) => {
          if (event.origin.includes('pesapal.com') || event.origin.includes('254liquors.com')) {
            // Cleanup logic
          }
        });
      }
    });
  };

  // Alternative modal with custom HTML if SweetAlert2 styling doesn't work well
  const openPaymentModalAlternative = (paymentUrl) => {
    Swal.fire({
      title: 'Pesapal Payment',
      html: `
        <div style="position: relative; width: 100%; height: 60vh;">
          <iframe 
            src="${paymentUrl}" 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
            title="Pesapal Payment Gateway"
            allow="payment *;"
          ></iframe>
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Close',
      width: '90%',
      padding: '0',
      background: '#fff',
      customClass: {
        popup: 'payment-modal-popup-alt',
        cancelButton: 'payment-modal-cancel-btn',
      },
      didOpen: () => {
        // Optional: Add message listener for postMessage from Pesapal
        window.addEventListener('message', function(event) {
          if (event.origin.includes('pesapal.com')) {
            if (event.data === 'payment-complete') {
              Swal.close();
              window.location.href = '/tips';
            }
          }
        });
      }
    });
  };

  const handlePay = () => {
    if (data) {
      handlePayment(
        data.price || plan.price,
        user?.email || "coongames8@gmail.com",
        `${data.plan} Plan For A ${data.billing}`,
        '/tips',
        setLoading,
        setNotification,
        openPaymentModal // Pass the modal opening function
      );
    }
  };

  return (
    <div className='pay'>
      <AppHelmet title={"Booking"} />
      <ScrollToTop />

      {loading && <Loader />}

      {data && (
        <h4>
          You Are About To Claim {data.type} Tips At {data.timeSlot} With {data.totalOdds} Odds For Only ${data.price}
        </h4>
      )}
      
      <form className="method">
        <fieldset>
          <input 
            name="payment-method" 
            type="radio" 
            value="mpesa" 
            id="mpesa" 
            checked={paymentType === "mpesa"} 
            onChange={(e) => setPaymentType(e.target.value)}
          />
          <label htmlFor="mpesa">📲 Mobile Payment</label>
        </fieldset>
        <fieldset>
          <input 
            name="payment-method" 
            type="radio" 
            value="card" 
            id="card" 
            checked={paymentType === "card"} 
            onChange={(e) => setPaymentType(e.target.value)}
          />
          <label htmlFor="card">💳 Credit Card</label>
        </fieldset>
      </form>
      
      <button className='btn' onClick={handlePay}>PAY NOW</button>
    </div>
  );
}

// Add this CSS to your Pay.scss file or create a new one
const additionalStyles = `
.payment-modal-popup {
  height: 600px !important;
  max-width: 900px !important;
}

.payment-modal-popup-alt {
  height: 80vh !important;
  max-width: 1000px !important;
}

.payment-modal-cancel-btn {
  margin-top: 10px !important;
  background-color: #6c757d !important;
}

.payment-modal-cancel-btn:hover {
  background-color: #5a6268 !important;
}
`;

// You can add this to your main CSS file or create a style tag
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = additionalStyles;
  document.head.appendChild(style);
}