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
  const [country, setCountry] = useState("AE");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function reload() { setState(await customBackendRequest("/payments/providers")); }
  useEffect(() => { let active = true; customBackendRequest("/payments/providers").then((value) => { if (active) setState(value); }).catch((error) => { if (active) setNotice(error.message || "Payment provider settings are unavailable."); }); return () => { active = false; }; }, []);
  async function action(callback, success) { setBusy(true); setNotice(""); try { const result = await callback(); setNotice(success(result)); await reload(); } catch (error) { setNotice(error.message || "The provider request failed."); } finally { setBusy(false); } }
  const tap = state?.providers?.find((provider) => provider.id === "tap");
  return <section className="payment-providers-card" aria-labelledby="payment-providers-title">
    <header><div><span>Merchant payments</span><h2 id="payment-providers-title">Payment providers</h2><p>Each provider account belongs to you. Customer card payments settle directly under your provider agreement. CYB commission is 0%.</p></div><strong>0% commission</strong></header>
    <article className="payment-provider-row"><div><h3>Tap Payments <span className={`provider-state ${tap?.status === "connected" ? "is-connected" : ""}`}>{tap?.status === "connected" ? "Test key saved" : "Not connected"}</span></h3><p>Enabled for UAE merchant test accounts in AED. Hosted Tap checkout shows only payment methods enabled for your Tap account.</p>{tap?.status === "connected" && <p>Test mode · {tap.country} · key ending {tap.secretLastFour || "••••"}{tap.connectionVerified ? " · API key verified" : " · connection not verified"}</p>}</div>
      {tap?.status === "connected" ? <div className="provider-actions"><button type="button" disabled={busy || tap.connectionVerified} onClick={() => action(() => customBackendRequest("/payments/providers/tap/verify-credentials", { method: "POST" }), (result) => result.verified ? "Tap test key verified without creating a payment." : "Tap key could not be verified.")}>{tap.connectionVerified ? "Test key verified" : "Verify test key"}</button><button type="button" className="provider-danger" disabled={busy} onClick={() => action(() => customBackendRequest("/payments/providers/tap/disconnect", { method: "POST" }), () => "Tap disconnected.")}>Disconnect</button></div> : <form className="provider-connect-form" onSubmit={(event) => { event.preventDefault(); void action(() => customBackendRequest("/payments/providers/connect", { method: "POST", body: JSON.stringify({ provider: "tap", country, secretKey }) }), () => "Tap test key saved. Verify it before running a sandbox checkout.").then(() => setSecretKey("")); }}><label>Merchant country<select value={country} onChange={(event) => setCountry(event.target.value)}><option value="AE">United Arab Emirates</option></select></label><label>Tap test secret key<input type="password" autoComplete="off" value={secretKey} onChange={(event) => setSecretKey(event.target.value)} placeholder="sk_test_…" required /></label><button type="submit" disabled={busy || !secretKey.startsWith("sk_test_")}>{busy ? "Saving…" : "Connect test account"}</button><small>Only test keys are accepted. Credentials are encrypted on the server and never returned to this page. Test checkout is limited to AED until additional country and currency eligibility is confirmed.</small></form>}</article>
    {tap?.platformAuthorization !== "approved" && <p className="payment-provider-notice">Tap requires CYB to obtain e-commerce platform authorization before sandbox merchant checkout is enabled. A saved key alone does not enable customer payments.</p>}
    <div className="payment-provider-disabled"><h3>Other providers</h3>{(state?.providers || []).filter((provider) => provider.id !== "tap").map((provider) => <div key={provider.id}><strong>{provider.name}</strong><span>{provider.status === "approval_required" ? "Approval or eligibility check required" : "Not enabled yet"}</span></div>)}</div>
    <div className="payment-history"><h3>Transaction history <small>Test mode</small></h3>{!state?.transactions?.length ? <p>No Tap transactions yet.</p> : <div className="payment-history-scroll"><table><thead><tr><th>Order</th><th>Status</th><th>Amount</th><th>Provider reference</th><th>Refund</th></tr></thead><tbody>{state.transactions.map((transaction) => <tr key={transaction.id}><td>{transaction.orderId || "—"}</td><td>{transaction.status}</td><td>{transaction.amountCents == null ? "—" : `${(transaction.amountCents / 100).toFixed(2)} ${transaction.currency}`}</td><td>{transaction.providerPaymentId || "—"}</td><td>{transaction.status === "CAPTURED" && transaction.orderId ? <button type="button" disabled={busy} onClick={() => { if (window.confirm("Issue a full refund through your Tap test account?")) void action(() => customBackendRequest(`/payments/providers/tap/orders/${encodeURIComponent(transaction.orderId)}/refund`, { method: "POST", body: JSON.stringify({ reason: "requested_by_customer" }) }), (result) => `Refund status: ${result.status}`); }}>Full refund</button> : transaction.refunds?.length ? transaction.refunds.at(-1).status : "—"}</td></tr>)}</tbody></table></div>}</div>
    {notice && <p role="status" className="payment-provider-notice">{notice}</p>}
  </section>;
}

export default Settings;
