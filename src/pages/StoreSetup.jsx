import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import { getStore, saveStore } from "../services/storeService";
import "../styles/storeSetup.css";

function formatStoreUrl(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function StoreSetup() {
  const navigate = useNavigate();

  const [storeName, setStoreName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [description, setDescription] = useState("");
  const [themeColor, setThemeColor] = useState("#111111");

  const [loadingStore, setLoadingStore] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadStore() {
      try {
        setLoadingStore(true);
        setMessage("");

        const store = await getStore();

        if (!store) {
          return;
        }

        setStoreName(
          store.storeName ||
            store.businessName ||
            ""
        );

        setStoreUrl(store.storeUrl || "");
        setDescription(store.description || "");

        setThemeColor(
          store.themeColor ||
            store.primaryColor ||
            "#111111"
        );
      } catch (error) {
        console.error("Error loading store:", error);
        setMessage("Could not load your store.");
      } finally {
        setLoadingStore(false);
      }
    }

    loadStore();
  }, []);

  const cleanedStoreUrl = useMemo(
    () => formatStoreUrl(storeUrl),
    [storeUrl]
  );

  async function handleSave(event) {
    event.preventDefault();
    setMessage("");

    const cleanedStoreName = storeName.trim();

    if (!cleanedStoreName) {
      setMessage("Please enter your store name.");
      return;
    }

    if (!cleanedStoreUrl) {
      setMessage("Please enter a valid store address.");
      return;
    }

    try {
      setSaving(true);

      await saveStore({
        storeName: cleanedStoreName,
        businessName: cleanedStoreName,
        storeUrl: cleanedStoreUrl,
        description: description.trim(),
        themeColor,
        primaryColor: themeColor,
        language: "English",
        currency: "USD",
      });
localStorage.setItem(
  "websiteSetup",
  JSON.stringify({
    businessName: cleanedStoreName,
    storeUrl: cleanedStoreUrl,
    description: description.trim(),
    themeColor,
  })
);

localStorage.setItem(
  "storeUrl",
  cleanedStoreUrl
);

      setStoreUrl(cleanedStoreUrl);
      setMessage("Store saved successfully.");

      setTimeout(() => {
        navigate("/store-designer");
      }, 500);
    } catch (error) {
      console.error("Error saving store:", error);

      setMessage(
        error.message ||
          "Could not save the store. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingStore) {
    return (
      <DashboardLayout>
        <div className="store-setup-loading">
          Loading store setup...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="store-setup-page">
        <header className="store-setup-header">
          <div>
            <span className="store-setup-eyebrow">
              Store setup
            </span>

            <h1>Build your store profile</h1>

            <p>
              Add the information that will shape your storefront.
              You can update these details later from your settings.
            </p>
          </div>

          <div className="store-setup-progress">
            <span>Setup progress</span>

            <strong>
              {storeName && cleanedStoreUrl ? "Ready" : "In progress"}
            </strong>

            <div className="store-setup-progress-track">
              <span
                style={{
                  width:
                    storeName && cleanedStoreUrl
                      ? "100%"
                      : storeName || cleanedStoreUrl
                        ? "60%"
                        : "25%",
                }}
              />
            </div>
          </div>
        </header>

        <form
          className="store-setup-form"
          onSubmit={handleSave}
        >
          <section className="store-setup-card">
            <div className="store-setup-card-number">
              01
            </div>

            <div className="store-setup-card-content">
              <div className="store-setup-card-heading">
                <div>
                  <span>Store identity</span>
                  <h2>Name your storefront</h2>
                </div>

                <p>
                  Choose the name customers will see across your
                  storefront, checkout, and order pages.
                </p>
              </div>

              <div className="store-setup-field">
                <label htmlFor="storeName">
                  Store name
                </label>

                <input
                  id="storeName"
                  type="text"
                  value={storeName}
                  onChange={(event) =>
                    setStoreName(event.target.value)
                  }
                  placeholder="Enter your store name"
                  autoComplete="organization"
                />

                <small>
                  Use the exact name of your business or brand.
                </small>
              </div>

              <div className="store-setup-field">
                <label htmlFor="description">
                  Store description
                </label>

                <textarea
                  id="description"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Describe what your store sells, what makes it different, and who it is for."
                  rows="6"
                  maxLength="300"
                />

                <div className="store-setup-field-footer">
                  <small>
                    Keep it clear and customer-friendly.
                  </small>

                  <span>{description.length}/300</span>
                </div>
              </div>
            </div>
          </section>

          <section className="store-setup-card">
            <div className="store-setup-card-number">
              02
            </div>

            <div className="store-setup-card-content">
              <div className="store-setup-card-heading">
                <div>
                  <span>Store address</span>
                  <h2>Create your public link</h2>
                </div>

                <p>
                  This is the address customers will use to open
                  your store online.
                </p>
              </div>

              <div className="store-setup-field">
                <label htmlFor="storeUrl">
                  Store URL
                </label>

                <div className="store-url-input">
                  <span>yourbusiness.com/store/</span>

                  <input
                    id="storeUrl"
                    type="text"
                    value={storeUrl}
                    onChange={(event) =>
                      setStoreUrl(event.target.value)
                    }
                    placeholder="your-store-name"
                    autoCapitalize="none"
                    spellCheck="false"
                  />
                </div>

                <div className="store-url-preview">
                  <span>Public address</span>

                  <strong>
                    yourbusiness.com/store/
                    {cleanedStoreUrl || "your-store-name"}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <section className="store-setup-card">
            <div className="store-setup-card-number">
              03
            </div>

            <div className="store-setup-card-content">
              <div className="store-setup-card-heading">
                <div>
                  <span>Brand style</span>
                  <h2>Choose your primary color</h2>
                </div>

                <p>
                  Your primary color will be used for buttons,
                  highlights, and important storefront details.
                </p>
              </div>

              <div className="store-brand-layout">
                <div
                  className="store-brand-preview"
                  style={{
                    "--store-color": themeColor,
                  }}
                >
                  <div className="store-brand-preview-top">
                    <strong>
                      {storeName || "Your Store"}
                    </strong>

                    <span>Menu</span>
                  </div>

                  <div className="store-brand-preview-main">
                    <span>New collection</span>

                    <h3>
                      {description ||
                        "A clear message about your store will appear here."}
                    </h3>

                    <button type="button">
                      Shop now
                    </button>
                  </div>
                </div>

                <div className="store-color-panel">
                  <label htmlFor="themeColor">
                    Primary color
                  </label>

                  <input
                    id="themeColor"
                    type="color"
                    value={themeColor}
                    onChange={(event) =>
                      setThemeColor(event.target.value)
                    }
                  />

                  <div className="store-color-value">
                    <span>Color value</span>

                    <strong>
                      {themeColor.toUpperCase()}
                    </strong>
                  </div>

                  <p>
                    Choose a color with enough contrast so text
                    and buttons remain easy to read.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {message && (
            <div
              className={`store-setup-message ${
                message.includes("successfully")
                  ? "success"
                  : "error"
              }`}
            >
              {message}
            </div>
          )}

          <div className="store-setup-actions">
            <div>
              <span>Next step</span>

              <strong>
                Customize your storefront design
              </strong>

              <p>
                Save your store profile before continuing to
                the Store Designer.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save and continue"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default StoreSetup;