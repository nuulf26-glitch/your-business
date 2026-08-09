import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";

function Subscribe() {
  const subscriptionPrice = "100.00";

  return (
    <PayPalScriptProvider
      options={{
       clientId:
  "BAACmyE3P-xf7p9EQEzBa6BM5kv0xGpdl6thskKkD8ZmR0gm4V9rEnSaMmNdOchMvO4HjXdBzau9ooj1Nc",
        currency: "usd",
      }}
    >
      <div
        style={{
          maxWidth: "500px",
          margin: "60px auto",
          padding: "30px",
          background: "white",
          borderRadius: "20px",
          boxShadow: "0 10px 30px rgba(0,0,0,.08)",
        }}
      >
        <h1>Subscribe</h1>

        <p>Start using Your Business platform.</p>

        <div
          style={{
            background: "#f8f8f8",
            padding: "20px",
            borderRadius: "12px",
            margin: "25px 0",
          }}
        >
          <h2>Platform Plan</h2>
          <p>Access your dashboard, store, products and orders.</p>
          <h2>{subscriptionPrice} usd</h2>
        </div>

        <PayPalButtons
          style={{
            layout: "vertical",
            shape: "rect",
            label: "paypal",
          }}
          createOrder={(data, actions) => {
            return actions.order.create({
              purchase_units: [
                {
                  description: "Your Business Platform Subscription",
                  amount: {
                    currency_code: "usd",
                    value: subscriptionPrice,
                  },
                },
              ],
            });
          }}
          onApprove={async (data, actions) => {
            const order = await actions.order.capture();

            console.log("PayPal payment completed:", order);

            alert("Subscription payment completed successfully!");
          }}
          onCancel={() => {
            alert("Payment was cancelled.");
          }}
          onError={(error) => {
            console.error("PayPal payment error:", error);
            alert("Payment failed. Please try again.");
          }}
        />
      </div>
    </PayPalScriptProvider>
  );
}

export default Subscribe;