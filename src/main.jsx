import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PayPalScriptProvider } from "@paypal/react-paypal-js";

import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <PayPalScriptProvider
      deferLoading={!import.meta.env.VITE_PAYPAL_CLIENT_ID}
      options={{
        clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "sb",
        currency: "USD",
        intent: "capture",
      }}
    >
      <App />
    </PayPalScriptProvider>
  </BrowserRouter>
);