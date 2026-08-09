const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

const PAYPAL_CLIENT_ID = defineSecret("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = defineSecret("PAYPAL_CLIENT_SECRET");

const PAYPAL_API = "https://api-m.sandbox.paypal.com";
const PAYMENT_AMOUNT = "245.00";
const PAYMENT_CURRENCY = "USD";

async function verifyFirebaseUser(request) {
  const authorization = request.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const idToken = authorization.replace("Bearer ", "").trim();

  if (!idToken) {
    throw new Error("UNAUTHORIZED");
  }

  return getAuth().verifyIdToken(idToken);
}

async function getPayPalAccessToken() {
  const clientId = PAYPAL_CLIENT_ID.value();
  const clientSecret = PAYPAL_CLIENT_SECRET.value();

  const basicAuth = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const paypalResponse = await fetch(
    `${PAYPAL_API}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }
  );

  const data = await paypalResponse.json();

  if (!paypalResponse.ok || !data.access_token) {
    console.error("PayPal token error:", data);
    throw new Error("PAYPAL_TOKEN_ERROR");
  }

  return data.access_token;
}

exports.apiStatus = onRequest(
  {
    cors: true,
  },
  (request, response) => {
    response.status(200).json({
      success: true,
      message: "Your Business backend is working.",
    });
  }
);

exports.createPayPalOrder = onRequest(
  {
    cors: true,
    secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET],
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({
        success: false,
        message: "Method not allowed.",
      });
      return;
    }

    try {
      const decodedToken = await verifyFirebaseUser(request);
      const accessToken = await getPayPalAccessToken();

      const paypalResponse = await fetch(
        `${PAYPAL_API}/v2/checkout/orders`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": `your-business-${decodedToken.uid}-${Date.now()}`,
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [
              {
                reference_id: decodedToken.uid,
                description: "Your Business Lifetime Access",
                custom_id: decodedToken.uid,
                amount: {
                  currency_code: PAYMENT_CURRENCY,
                  value: PAYMENT_AMOUNT,
                },
              },
            ],
          }),
        }
      );

      const order = await paypalResponse.json();

      if (!paypalResponse.ok) {
        console.error("Create PayPal order error:", order);

        response.status(paypalResponse.status).json({
          success: false,
          message: "Could not create PayPal order.",
        });
        return;
      }

      response.status(200).json({
        success: true,
        orderId: order.id,
      });
    } catch (error) {
      console.error("createPayPalOrder error:", error);

      const status = error.message === "UNAUTHORIZED" ? 401 : 500;

      response.status(status).json({
        success: false,
        message:
          status === 401
            ? "You must be signed in."
            : "Could not create PayPal order.",
      });
    }
  }
);

exports.capturePayPalOrder = onRequest(
  {
    cors: true,
    secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET],
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({
        success: false,
        message: "Method not allowed.",
      });
      return;
    }

    try {
      const decodedToken = await verifyFirebaseUser(request);
      const orderId = request.body?.orderId;

      if (!orderId) {
        response.status(400).json({
          success: false,
          message: "PayPal order ID is required.",
        });
        return;
      }

      const accessToken = await getPayPalAccessToken();

      const paypalResponse = await fetch(
        `${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const captureData = await paypalResponse.json();

      if (!paypalResponse.ok) {
        console.error("Capture PayPal error:", captureData);

        response.status(paypalResponse.status).json({
          success: false,
          message: "Could not capture PayPal payment.",
        });
        return;
      }

      const purchaseUnit = captureData.purchase_units?.[0];
      const capture = purchaseUnit?.payments?.captures?.[0];

      const paymentCompleted =
        captureData.status === "COMPLETED" &&
        capture?.status === "COMPLETED";

      const correctAmount =
        capture?.amount?.currency_code === PAYMENT_CURRENCY &&
        capture?.amount?.value === PAYMENT_AMOUNT;

      const correctUser =
        purchaseUnit?.reference_id === decodedToken.uid ||
        purchaseUnit?.custom_id === decodedToken.uid;

      if (!paymentCompleted || !correctAmount || !correctUser) {
        console.error("Invalid PayPal capture:", {
          paymentCompleted,
          correctAmount,
          correctUser,
          captureData,
        });

        response.status(400).json({
          success: false,
          message: "Payment verification failed.",
        });
        return;
      }

      await db.collection("users").doc(decodedToken.uid).set(
        {
          paid: true,
          plan: "Basic",
          subscriptionStatus: "active",
          paymentProvider: "paypal",
          paymentType: "one_time",
          paymentAmount: Number(PAYMENT_AMOUNT),
          paymentCurrency: PAYMENT_CURRENCY,
          paypalOrderId: captureData.id,
          paypalCaptureId: capture.id,
          paidAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      response.status(200).json({
        success: true,
        status: "COMPLETED",
        orderId: captureData.id,
      });
    } catch (error) {
      console.error("capturePayPalOrder error:", error);

      const status = error.message === "UNAUTHORIZED" ? 401 : 500;

      response.status(status).json({
        success: false,
        message:
          status === 401
            ? "You must be signed in."
            : "Could not complete PayPal payment.",
      });
    }
  }
);