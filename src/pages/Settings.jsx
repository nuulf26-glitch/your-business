import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { customBackendRequest, subscribeAppUser } from "../services/customBackendSession";
import { getStore, saveStore } from "../services/storeService";
import "../styles/settings.css";

// قائمة شاملة لكل عملات العالم مع رموزها ومفاتيح الهاتف الخاصة بها
const WORLD_CURRENCIES = [
  { code: "AED", name: "UAE Dirham (AED)", phoneCode: "+971", symbol: "د.إ" },
  { code: "SAR", name: "Saudi Riyal (SAR)", phoneCode: "+966", symbol: "ر.س" },
  { code: "USD", name: "US Dollar (USD)", phoneCode: "+1", symbol: "$" },
  { code: "EUR", name: "Euro (EUR)", phoneCode: "+33", symbol: "€" },
  { code: "GBP", name: "British Pound (GBP)", phoneCode: "+44", symbol: "£" },
  { code: "QAR", name: "Qatari Riyal (QAR)", phoneCode: "+974", symbol: "ر.ق" },
  { code: "KWD", name: "Kuwaiti Dinar (KWD)", phoneCode: "+965", symbol: "د.ك" },
  { code: "BHD", name: "Bahraini Dinar (BHD)", phoneCode: "+973", symbol: "د.ب" },
  { code: "OMR", name: "Omani Rial (OMR)", phoneCode: "+968", symbol: "ر.ع" },
  { code: "EGP", name: "Egyptian Pound (EGP)", phoneCode: "+20", symbol: "ج.م" },
  { code: "CAD", name: "Canadian Dollar (CAD)", phoneCode: "+1", symbol: "CA$" },
  { code: "AUD", name: "Australian Dollar (AUD)", phoneCode: "+61", symbol: "AU$" },
  { code: "JPY", name: "Japanese Yen (JPY)", phoneCode: "+81", symbol: "¥" },
  { code: "INR", name: "Indian Rupee (INR)", phoneCode: "+91", symbol: "₹" }
];

function Settings() {
  const [user, setUser] = useState(null);

  const [businessName, setBusinessName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [storeCurrency, setStoreCurrency] = useState("USD");
  const [phonePrefix, setPhonePrefix] = useState("+1");
  const [phone, setPhone] = useState("");
  const [deliveryPolicy, setDeliveryPolicy] = useState("");
  const [returnPolicy, setReturnPolicy] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // تحديث مفتاح الهاتف تلقائياً عند تغيير العملة
  function handleCurrencyChange(newCurrencyCode) {
    setStoreCurrency(newCurrencyCode);
    const found = WORLD_CURRENCIES.find(c => c.code === newCurrencyCode);
    if (found) {
      setPhonePrefix(found.phoneCode);
    }
  }

  useEffect(() => {
    const unsubscribe = subscribeAppUser(
      async (currentUser) => {
        if (!currentUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(currentUser);
        setBusinessEmail(currentUser.email || "");

        try {
          const data = await getStore();
          if (data) {
            setBusinessName(
              data.businessName || data.storeName || ""
            );
            setBusinessEmail(
              data.businessEmail || currentUser.email || ""
            );
            setSupportEmail(data.supportEmail || "");
            
            // قراءة العملة والمفتاح المحفوظين مسبقاً إن وجدوا
            const savedCurrency = data.currency || "USD";
            setStoreCurrency(savedCurrency);
            
            const matchedCurrency = WORLD_CURRENCIES.find(c => c.code === savedCurrency);
            if (matchedCurrency) {
              setPhonePrefix(matchedCurrency.phoneCode);
            }

            setPhone(data.phone || "");
            setDeliveryPolicy(data.deliveryPolicy || "");
            setReturnPolicy(data.returnPolicy || "");
          }
        } catch (error) {
          console.error("Error loading settings:", error);
          setMessage("Could not load settings.");
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  async function handleSave(event) {
    event.preventDefault();

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    if (!businessName.trim()) {
      setMessage("Please enter your business name.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const existing = await getStore();
      await saveStore({
        ...(existing || {}),
        storeUrl: existing?.storeUrl || `business-${String(user.uid).slice(-8)}`,
        storeName: businessName.trim(), businessName: businessName.trim(),
        businessEmail: businessEmail.trim(), supportEmail: supportEmail.trim(),
        phonePrefix, phone: phone.trim(), currency: storeCurrency,
        deliveryPolicy: deliveryPolicy.trim(), returnPolicy: returnPolicy.trim(),
      });
      setMessage("Settings saved successfully.");
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage("Could not save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="settings-loading">
          Loading settings...
        </div>
      </DashboardLayout>
    );
  }

  // البحث عن الرمز الحالي لعرضه في الهيدر
  const currentCurrencyObj = WORLD_CURRENCIES.find(c => c.code === storeCurrency) || { symbol: "$", name: "US Dollar" };

  return (
    <DashboardLayout>
      <div className="settings-page">
        <header className="settings-header">
          <div>
            <span>Store settings</span>
            <h1>Settings</h1>
            <p>
              Manage your business information, store currency,
              and customer policies.
            </p>
          </div>

          <div className="settings-status-card">
            <span>Store currency</span>
            <strong>{storeCurrency}</strong>
            <p>{currentCurrencyObj.name}</p>
          </div>
        </header>

        <form className="settings-form" onSubmit={handleSave}>
          <section className="settings-card">
            <div className="settings-card-heading">
              <div>
                <span>Business profile</span>
                <h2>Business information</h2>
              </div>

              <p>
                This information will be used across your
                dashboard and storefront.
              </p>
            </div>

            <div className="settings-grid">
              <div className="settings-field">
                <label htmlFor="businessName">
                  Business name
                </label>

                <input
                  id="businessName"
                  type="text"
                  value={businessName}
                  onChange={(event) =>
                    setBusinessName(event.target.value)
                  }
                  placeholder="Enter your business name"
                  autoComplete="organization"
                />
              </div>

              <div className="settings-field">
                <label htmlFor="businessEmail">
                  Business email
                </label>

                <input
                  id="businessEmail"
                  type="email"
                  value={businessEmail}
                  onChange={(event) =>
                    setBusinessEmail(event.target.value)
                  }
                  placeholder="business@example.com"
                  autoComplete="email"
                />
              </div>
<div className="settings-field">
  <label htmlFor="supportEmail">
    Support email
  </label>

  <input
    id="supportEmail"
    type="email"
    value={supportEmail}
    onChange={(event) =>
      setSupportEmail(event.target.value)
    }
    placeholder="support@example.com"
  />
</div>
              {/* اختيار العملة لكل عملات العالم */}
              <div className="settings-field">
                <label htmlFor="currency">
                  Store currency
                </label>

                <select
                  id="currency"
                  value={storeCurrency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    fontSize: "0.95rem"
                  }}
                >
                  {WORLD_CURRENCIES.map((cur) => (
                    <option key={cur.code} value={cur.code}>
                      {cur.name} ({cur.symbol})
                    </option>
                  ))}
                </select>
              </div>

              {/* رقم الهاتف مع مفتاح الاتصال المتغير تلقائياً حسب العملة */}
              <div className="settings-field">
                <label htmlFor="phone">
                  Phone number
                </label>

                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={phonePrefix}
                    readOnly
                    style={{
                      width: "85px",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#f1f5f9",
                      textAlign: "center",
                      fontWeight: "700"
                    }}
                  />
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                    placeholder="212 555 0198"
                    autoComplete="tel"
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading">
              <div>
                <span>Customer policies</span>
                <h2>Store policies</h2>
              </div>

              <p>
                Add clear delivery and return information for
                your customers.
              </p>
            </div>

            <div className="settings-policy-grid">
              <div className="settings-field">
                <label htmlFor="deliveryPolicy">
                  Delivery policy
                </label>

                <textarea
                  id="deliveryPolicy"
                  value={deliveryPolicy}
                  onChange={(event) =>
                    setDeliveryPolicy(event.target.value)
                  }
                  placeholder="Example: Orders are delivered within 2 to 4 business days."
                  rows="7"
                />
              </div>

              <div className="settings-field">
                <label htmlFor="returnPolicy">
                  Return policy
                </label>

                <textarea
                  id="returnPolicy"
                  value={returnPolicy}
                  onChange={(event) =>
                    setReturnPolicy(event.target.value)
                  }
                  placeholder="Example: Returns are accepted within 7 days if the item is unused."
                  rows="7"
                />
              </div>
            </div>
          </section>

          {message && (
            <div
              className={`settings-message ${
                message.includes("successfully")
                  ? "success"
                  : "error"
              }`}
            >
              {message}
            </div>
          )}

          <div className="settings-actions">
            <div>
              <strong>Save your changes</strong>
              <span>
                Your settings will be updated in your store account.
              </span>
            </div>

            <button
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </form>

        <PaymentProvidersPanel />
      </div>
    </DashboardLayout>
  );
}

function PaymentProvidersPanel() {
  const [state, setState] = useState(null);
  const [secretKey, setSecretKey] = useState("");
  const [stripeRestrictedTestKey, setStripeRestrictedTestKey] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [country, setCountry] = useState("AE");
  const [bankTransfer, setBankTransfer] = useState({ enabled: false, bankName: "", accountName: "", iban: "", swift: "" });
  const [externalPaymentLink, setExternalPaymentLink] = useState({ enabled: false, urlTemplate: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function reload() { const value = await customBackendRequest("/payments/providers"); setState(value); if(value.manualOptions){setBankTransfer(value.manualOptions.bankTransfer);setExternalPaymentLink(value.manualOptions.externalPaymentLink);} }
  useEffect(() => { let active = true; customBackendRequest("/payments/providers").then((value) => { if (active) { setState(value); if(value.manualOptions){setBankTransfer(value.manualOptions.bankTransfer);setExternalPaymentLink(value.manualOptions.externalPaymentLink);} } }).catch((error) => { if (active) setNotice(error.message || "Payment provider settings are unavailable."); }); return () => { active = false; }; }, []);
  async function action(callback, success) { setBusy(true); setNotice(""); try { const result = await callback(); setNotice(success(result)); await reload(); } catch (error) { setNotice(error.message || "The provider request failed."); } finally { setBusy(false); } }
  const tap = state?.providers?.find((provider) => provider.id === "tap");
  const stripe = state?.providers?.find((provider) => provider.id === "stripe");
  const manualTransactions = (state?.transactions || []).filter((transaction) => ["bank_transfer", "external_payment_link"].includes(transaction.provider));
  return <section className="payment-providers-card" aria-labelledby="payment-providers-title">
    <header><div><span>Merchant payments</span><h2 id="payment-providers-title">Payment providers</h2><p>Each provider account belongs to you. Customer card payments settle directly under your provider agreement. CYB commission is 0%.</p></div><strong>0% commission</strong></header>
    <article className="payment-provider-row"><div><h3>Tap Payments <span className={`provider-state ${tap?.status === "connected" ? "is-connected" : ""}`}>{tap?.status === "connected" ? "Test key saved" : tap?.status === "approval_required" ? "Approval required" : "Not connected"}</span></h3><p>UAE · AED sandbox foundation. Customer checkout stays disabled until Tap confirms CYB’s merchant-owned integration model in writing. Hosted checkout will show only the methods enabled in your own Tap account.</p>{tap?.status === "connected" && <p>Test mode · {tap.country} · key ending {tap.secretLastFour || "••••"}{tap.connectionVerified ? " · API key verified" : " · connection not verified"}</p>}{tap?.status === "approval_required" && <p>{tap.reason}</p>}</div>
      {tap?.status === "connected" ? <div className="provider-actions"><button type="button" disabled={busy || tap.connectionVerified} onClick={() => action(() => customBackendRequest("/payments/providers/tap/verify-credentials", { method: "POST" }), (result) => result.verified ? "Tap test key verified without creating a payment." : "Tap key could not be verified.")}>{tap.connectionVerified ? "Test key verified" : "Verify test key"}</button><button type="button" className="provider-danger" disabled={busy} onClick={() => action(() => customBackendRequest("/payments/providers/tap/disconnect", { method: "POST" }), () => "Tap disconnected.")}>Disconnect</button></div> : tap?.platformAuthorization === "approved" && <form className="provider-connect-form" onSubmit={(event) => { event.preventDefault(); void action(() => customBackendRequest("/payments/providers/connect", { method: "POST", body: JSON.stringify({ provider: "tap", country, secretKey }) }), () => "Tap test key saved. Verify it before running a sandbox checkout.").then(() => setSecretKey("")); }}><label>Merchant country<select value={country} onChange={(event) => setCountry(event.target.value)}><option value="AE">United Arab Emirates</option></select></label><label>Tap test secret key<input type="password" autoComplete="off" value={secretKey} onChange={(event) => setSecretKey(event.target.value)} placeholder="sk_test_…" required /></label><button type="submit" disabled={busy || !secretKey.startsWith("sk_test_")}>{busy ? "Saving…" : "Connect test account"}</button><small>Only test keys are accepted. Credentials are encrypted on the server and never returned to this page. Test checkout is limited to AED until additional country and currency eligibility is confirmed.</small></form>}</article>
    <article className="payment-provider-row"><div><h3>Stripe <span className={`provider-state ${stripe?.status === "connected" ? "is-connected" : ""}`}>{stripe?.status === "connected" ? (stripe.connectionVerified ? "Test account verified" : "Test key saved") : "Not connected"}</span></h3><p>Sandbox only · UAE merchants · AED. Stripe Payment Element supports Visa and Mastercard; Stripe Express Checkout can show Apple Pay or Google Pay when enabled and eligible for the account, registered store domain, currency, and buyer device. CYB never adds a transaction commission.</p>{stripe?.status === "connected" && <p>Restricted test key ending {stripe.secretLastFour || "••••"}{stripe.connectionVerified ? ` · verified ${stripe.country} account` : " · not verified"}</p>}{stripe?.webhookUrl && <p>Register the store domain in Stripe test settings for Apple Pay where required. Configure the signed test webhook endpoint in Stripe for <code>{stripe.webhookUrl}</code>, then paste its signing secret below.</p>}</div>
      {stripe?.status === "connected" ? <div className="provider-actions"><button type="button" disabled={busy || stripe.connectionVerified} onClick={() => action(() => customBackendRequest("/payments/providers/stripe/verify-credentials", { method: "POST" }), (result) => result.verified ? "Stripe restricted test account verified; no payment was created." : "Stripe key could not be verified.")}>{stripe.connectionVerified ? "Test account verified" : "Verify test account"}</button><button type="button" className="provider-danger" disabled={busy} onClick={() => action(() => customBackendRequest("/payments/providers/stripe/disconnect", { method: "POST" }), () => "Stripe test account disconnected.")}>Disconnect</button></div> : <form className="provider-connect-form" onSubmit={(event) => { event.preventDefault(); void action(() => customBackendRequest("/payments/providers/stripe/connect", { method: "POST", body: JSON.stringify({ provider: "stripe", country: "AE", restrictedTestKey: stripeRestrictedTestKey, publishableKey: stripePublishableKey, webhookSecret: stripeWebhookSecret }) }), () => "Stripe restricted test credentials saved encrypted. Verify the account before sandbox checkout.").then(() => { setStripeRestrictedTestKey(""); setStripePublishableKey(""); setStripeWebhookSecret(""); }); }}><label>Stripe restricted test key<input type="password" autoComplete="off" value={stripeRestrictedTestKey} onChange={(event) => setStripeRestrictedTestKey(event.target.value)} placeholder="rk_test_…" required /></label><label>Stripe publishable test key<input type="password" autoComplete="off" value={stripePublishableKey} onChange={(event) => setStripePublishableKey(event.target.value)} placeholder="pk_test_…" required /></label><label>Webhook signing secret<input type="password" autoComplete="off" value={stripeWebhookSecret} onChange={(event) => setStripeWebhookSecret(event.target.value)} placeholder="whsec_…" required /></label><button type="submit" disabled={busy || !stripeRestrictedTestKey.startsWith("rk_test_") || !stripePublishableKey.startsWith("pk_test_") || !stripeWebhookSecret.startsWith("whsec_")}>{busy ? "Saving…" : "Connect restricted test account"}</button><small>Generate a restricted test key in your own Stripe account with only required read, payment, and refund permissions. Credentials are encrypted server-side and never returned. Live keys are rejected. Sandbox checkout stays unavailable until key verification, signed webhook setup, and Apple Pay domain verification where needed. UAE Stripe accounts must satisfy Stripe’s merchant onboarding and verification rules.</small></form>}</article>
    {tap?.platformAuthorization !== "approved" && <p className="payment-provider-notice">Tap requires CYB to obtain e-commerce platform authorization before sandbox merchant checkout is enabled. A saved key alone does not enable customer payments.</p>}
    <div className="payment-provider-grid">{(state?.providers || []).filter((provider) => !["tap", "stripe", "bank_transfer", "external_payment_link", "cash_on_delivery"].includes(provider.id)).map((provider) => <article className="payment-provider-tile" key={provider.id}><div><strong>{provider.name}</strong><span className="provider-state">{provider.status === "approval_required" ? "Approval required" : "Disabled"}</span></div><p>{provider.reason || "Not configured for merchant checkout."}</p></article>)}</div>
    <div className="payment-manual-options">
      <h3>Bank transfer</h3><p>Share the merchant bank details and the exact order amount/reference. The order stays unpaid until you verify the transfer.</p>
      <div className="provider-connect-form manual-options-form">
        <label>Bank name<input value={bankTransfer.bankName} onChange={(event) => setBankTransfer({...bankTransfer,bankName:event.target.value})} placeholder="Bank name" /></label>
        <label>Account holder<input value={bankTransfer.accountName} onChange={(event) => setBankTransfer({...bankTransfer,accountName:event.target.value})} placeholder="Account holder" /></label>
        <label>IBAN<input value={bankTransfer.iban} onChange={(event) => setBankTransfer({...bankTransfer,iban:event.target.value})} placeholder="AE…" autoComplete="off" /></label>
        <label>SWIFT / BIC (optional)<input value={bankTransfer.swift} onChange={(event) => setBankTransfer({...bankTransfer,swift:event.target.value})} placeholder="SWIFT / BIC" autoComplete="off" /></label>
        <label className="provider-toggle"><input type="checkbox" checked={bankTransfer.enabled} onChange={(event) => setBankTransfer({...bankTransfer,enabled:event.target.checked})} /> Enable bank transfer</label>
      </div>
      <h3>External payment link</h3><p>Use a provider link template that accepts an order amount and reference. CYB shows the exact total and keeps the order unpaid until you confirm receipt.</p>
      <div className="provider-connect-form manual-options-form">
        <label className="manual-url-field">HTTPS payment-link template<input value={externalPaymentLink.urlTemplate} onChange={(event) => setExternalPaymentLink({...externalPaymentLink,urlTemplate:event.target.value})} placeholder="https://payments.example/link?amount={amount}&reference={order}&currency={currency}" autoComplete="off" /></label>
        <label className="provider-toggle"><input type="checkbox" checked={externalPaymentLink.enabled} onChange={(event) => setExternalPaymentLink({...externalPaymentLink,enabled:event.target.checked})} /> Enable external link</label>
        <small>Required placeholders: {'{amount}'} and {'{order}'}; optional: {'{currency}'}. Use HTTPS only. Confirm the paid status in your provider before marking the order paid in CYB.</small>
      </div>
      <button type="button" disabled={busy} onClick={() => action(() => customBackendRequest("/payments/providers/manual-options", { method:"POST", body:JSON.stringify({bankTransfer,externalPaymentLink}) }), () => "Manual payment options saved.")}>{busy ? "Saving…" : "Save manual payment options"}</button>
    </div>
    <div className="payment-provider-disabled"><h3>Manual collection</h3>{(state?.providers || []).filter((provider) => ["bank_transfer", "external_payment_link", "cash_on_delivery"].includes(provider.id)).map((provider) => <div key={provider.id}><strong>{provider.name}</strong><span>{provider.status === "available" ? "Always available" : provider.status === "connected" ? "Configured" : "Not configured"}</span></div>)}</div>
    <div className="payment-history"><h3>Manual payment confirmation</h3>{!manualTransactions.length ? <p>No external-link or bank-transfer orders awaiting confirmation.</p> : <div className="payment-history-scroll"><table><thead><tr><th>Order</th><th>Method</th><th>Status</th><th>Amount</th><th>Action</th></tr></thead><tbody>{manualTransactions.map((transaction) => <tr key={transaction.id}><td>{transaction.orderId || "—"}</td><td>{transaction.provider === "bank_transfer" ? "Bank transfer" : "External link"}</td><td>{transaction.status === "awaiting_confirmation" ? "Awaiting confirmation" : transaction.status}</td><td>{transaction.amountCents == null ? "—" : `${(transaction.amountCents / 100).toFixed(2)} ${transaction.currency}`}</td><td>{transaction.status === "awaiting_confirmation" && transaction.orderId ? <button type="button" disabled={busy} onClick={() => { if(window.confirm("Confirm that you verified this payment in your bank/provider account?")) void action(() => customBackendRequest(`/orders/${encodeURIComponent(transaction.orderId)}/payment`, {method:"PATCH",body:JSON.stringify({data:{status:"paid"}})}), () => "Payment confirmed and revenue recorded once."); }}>Confirm received</button> : transaction.status === "Paid" || transaction.status === "paid" ? "Confirmed" : "—"}</td></tr>)}</tbody></table></div>}</div>
    <div className="payment-history"><h3>Transaction history <small>Sandbox and manual payments</small></h3>{!state?.transactions?.length ? <p>No payment transactions yet.</p> : <div className="payment-history-scroll"><table><thead><tr><th>Order</th><th>Provider</th><th>Status</th><th>Amount</th><th>Provider reference</th><th>Refund</th></tr></thead><tbody>{state.transactions.map((transaction) => <tr key={transaction.id}><td>{transaction.orderId || "—"}</td><td>{transaction.provider === "external_payment_link" ? "External link" : transaction.provider === "bank_transfer" ? "Bank transfer" : transaction.provider === "stripe" ? "Stripe" : "Tap"}</td><td>{transaction.status}</td><td>{transaction.amountCents == null ? "—" : `${(transaction.amountCents / 100).toFixed(2)} ${transaction.currency}`}</td><td>{transaction.providerPaymentId || transaction.reference || "—"}</td><td>{((transaction.provider === "tap" && transaction.status === "CAPTURED") || (transaction.provider === "stripe" && ["succeeded", "paid", "SUCCEEDED"].includes(transaction.status))) && transaction.orderId ? <button type="button" disabled={busy} onClick={() => { if (window.confirm("Issue a full refund through this provider test account?")) void action(() => customBackendRequest(`/payments/providers/${transaction.provider}/orders/${encodeURIComponent(transaction.orderId)}/refund`, { method: "POST", body: JSON.stringify({ reason: "requested_by_customer" }) }), (result) => `Refund status: ${result.status}`); }}>Full refund</button> : transaction.refunds?.length ? transaction.refunds.at(-1).status : "—"}</td></tr>)}</tbody></table></div>}</div>
    {notice && <p role="status" className="payment-provider-notice">{notice}</p>}
  </section>;
}

export default Settings;
