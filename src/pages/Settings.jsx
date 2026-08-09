import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import DashboardLayout from "../layouts/DashboardLayout";
import { auth, db } from "../firebase";
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
  const [storeDocId, setStoreDocId] = useState("");

  const [businessName, setBusinessName] = useState("");
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
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(currentUser);
        setBusinessEmail(currentUser.email || "");

        try {
          const storesQuery = query(
            collection(db, "stores"),
            where("userId", "==", currentUser.uid)
          );

          const snapshot = await getDocs(storesQuery);

          if (!snapshot.empty) {
            const storeDocument = snapshot.docs[0];
            const data = storeDocument.data();

            setStoreDocId(storeDocument.id);
            setBusinessName(
              data.businessName || data.storeName || ""
            );
            setBusinessEmail(
              data.businessEmail || currentUser.email || ""
            );
            
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

      const documentId = storeDocId || user.uid;
      const storeReference = doc(db, "stores", documentId);

      await setDoc(
        storeReference,
        {
          userId: user.uid,
          businessName: businessName.trim(),
          businessEmail: businessEmail.trim(),
          phonePrefix: phonePrefix,
          phone: phone.trim(),
          currency: storeCurrency,
          deliveryPolicy: deliveryPolicy.trim(),
          returnPolicy: returnPolicy.trim(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setStoreDocId(documentId);
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
      </div>
    </DashboardLayout>
  );
}

export default Settings;