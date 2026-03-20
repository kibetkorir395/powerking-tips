import { useState } from "react";
import CryptoPayments from "./CryptoPayments";
//import './Payments.scss'
import AppHelmet from "../../components/AppHelmet";
import PesapalPayments from "./PesapalPayments";



export default function Payments({ setUserData }) {
    const [paymentType, setPaymentType] = useState("mpesa")
    const renderPaymentType = () => {
        let item;
        switch (paymentType) {
            case "crypto":
                item = <CryptoPayments setUserData={setUserData} />
                break;
            default:
                item = <PesapalPayments setUserData={setUserData} />
        }

        return item;
    }
    return (
        <div className="payments">
            <AppHelmet title={"Pay"} location={'/pay'} />
            <div className="wrapper">
                <h2>select payment method</h2>
                <form className="method">
                    <fieldset>
                        <input name="payment-method" type="radio" value={"mpesa"} id="mpesa" checked={paymentType === "mpesa"} onChange={(e) => setPaymentType(e.target.value)} />
                        <label htmlFor="mpesa">mpesa 📲</label>
                    </fieldset>
                    <fieldset>
                        <input name="payment-method" type="radio" value={"crypto"} id="crypto" checked={paymentType === "crypto"} onChange={(e) => setPaymentType(e.target.value)} />
                        <label htmlFor="crypto">crypto ₿</label>
                    </fieldset>
                    {/*<fieldset>
                        <input name="payment-method" type="radio" value={"paypal"} id="paypal" checked={paymentType === "paypal"} onChange={(e) => setPaymentType(e.target.value)}/>
                        <label htmlFor="paypal">paypal</label>
                    </fieldset>
                    <fieldset>
                        <input name="payment-method" type="radio" value={"other"} id="other" checked={paymentType === "other"} onChange={(e) => setPaymentType(e.target.value)}/>
                        <label htmlFor="other">other</label>
                    </fieldset>*/}
                </form>
            </div>
            {
                renderPaymentType()
            }
        </div>
    )
}
