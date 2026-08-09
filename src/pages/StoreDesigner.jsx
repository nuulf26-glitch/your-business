import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import DashboardLayout from "../layouts/DashboardLayout";
import { auth, db } from "../firebase";

const templates = [
  {
    id: "ivory",
    name: "Ivory",
    description: "Clean, bright, and minimal.",
  },
  {
    id: "champagne",
    name: "Champagne",
    description: "Soft, elegant, and refined.",
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Bold, dark, and modern.",
  },
];

const cardStyles = [
  {
    id: "rounded",
    name: "Rounded",
  },
  {
    id: "soft",
    name: "Soft Corners",
  },
  {
    id: "square",
    name: "Square",
  },
];

function StoreDesigner() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [storeId, setStoreId] = useState("");

  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");

  const [logoUrl, setLogoUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");

  const [logoPreview, setLogoPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");

  const [primaryColor, setPrimaryColor] = useState("#111111");
  const [backgroundColor, setBackgroundColor] = useState("#f7f7f7");
  const [textColor, setTextColor] = useState("#111111");

  const [template, setTemplate] = useState("ivory");
  const [cardStyle, setCardStyle] = useState("rounded");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        loadStore(currentUser.uid);
      } else {
        setLoading(false);
        setError("You must be logged in.");
      }
    });

    return () => unsubscribe();
  }, []);

  async function loadStore(userId) {
    try {
      setLoading(true);
      setError("");

      const storeQuery = query(
        collection(db, "stores"),
        where("userId", "==", userId)
      );

      const snapshot = await getDocs(storeQuery);

      if (snapshot.empty) {
        setError("Create your store before opening the Store Designer.");
        return;
      }

      const storeDocument = snapshot.docs[0];
      const storeData = storeDocument.data();

      setStoreId(storeDocument.id);

      setStoreName(
        storeData.storeName ||
          storeData.businessName ||
          storeData.name ||
          ""
      );

      setDescription(
        storeData.description ||
          storeData.storeDescription ||
          ""
      );

      setLogoUrl(storeData.logoUrl || "");
      setCoverImageUrl(storeData.coverImageUrl || "");

      setLogoPreview(storeData.logoUrl || "");
      setCoverPreview(storeData.coverImageUrl || "");

      setPrimaryColor(storeData.primaryColor || "#111111");
      setBackgroundColor(storeData.backgroundColor || "#f7f7f7");
      setTextColor(storeData.textColor || "#111111");

      const savedTemplate = storeData.template;

      if (
        savedTemplate === "modern" ||
        savedTemplate === "minimal"
      ) {
        setTemplate("ivory");
      } else if (savedTemplate === "luxury") {
        setTemplate("champagne");
      } else {
        setTemplate(savedTemplate || "ivory");
      }

      setCardStyle(storeData.cardStyle || "rounded");
    } catch (loadError) {
      console.error("Error loading store design:", loadError);
      setError("Could not load your store design.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogoFile(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    setError("");

    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
  }

  function handleCoverFile(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    setError("");

    const previewUrl = URL.createObjectURL(file);
    setCoverPreview(previewUrl);
  }

  async function handleSaveDesign(event) {
    event.preventDefault();

    if (!user || !storeId) {
      setError("Store not found.");
      return;
    }

    if (!storeName.trim()) {
      setError("Please enter your store name.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const storeReference = doc(db, "stores", storeId);

      await updateDoc(storeReference, {
        storeName: storeName.trim(),
        businessName: storeName.trim(),
        name: storeName.trim(),

        description: description.trim(),
        storeDescription: description.trim(),

        logoUrl: logoUrl.trim(),
        coverImageUrl: coverImageUrl.trim(),

        primaryColor,
        backgroundColor,
        textColor,

        template,
        cardStyle,

        designUpdatedAt: new Date().toISOString(),
      });

      setSuccessMessage("Store design saved successfully.");

      window.setTimeout(() => {
        navigate("/dashboard");
      }, 700);
    } catch (saveError) {
      console.error("Error saving store design:", saveError);
      setError("Could not save your store design.");
    } finally {
      setSaving(false);
    }
  }

  const selectedTemplate = useMemo(() => {
    return (
      templates.find((item) => item.id === template) ||
      templates[0]
    );
  }, [template]);

  function getCardRadius() {
    if (cardStyle === "square") {
      return "0px";
    }

    if (cardStyle === "soft") {
      return "8px";
    }

    return "18px";
  }

  function getTemplateClass() {
    return `designer-preview designer-template-${template}`;
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="designer-loading">
          Loading Store Designer...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="store-designer-page">
        <header className="designer-header">
          <div>
            <span>Website editor</span>

            <h1>Store Designer</h1>

            <p>
              Customize your storefront layout, colors, images,
              and product card style.
            </p>
          </div>

          <div className="designer-template-status">
            <span>Selected template</span>
            <strong>{selectedTemplate.name}</strong>
            <p>{selectedTemplate.description}</p>
          </div>
        </header>

        {error && (
          <div className="designer-message error">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="designer-message success">
            {successMessage}
          </div>
        )}

        <div className="designer-layout">
          <form
            className="designer-editor"
            onSubmit={handleSaveDesign}
          >
            <section className="designer-section">
              <div className="designer-section-heading">
                <span>01</span>

                <div>
                  <h2>Store information</h2>

                  <p>
                    Edit the name and description shown on your
                    public storefront.
                  </p>
                </div>
              </div>

              <div className="designer-row">
                <div className="designer-row-label">
                  <label htmlFor="designerStoreName">
                    Store name
                  </label>

                  <p>
                    The main name displayed at the top of your store.
                  </p>
                </div>

                <input
                  id="designerStoreName"
                  type="text"
                  value={storeName}
                  onChange={(event) =>
                    setStoreName(event.target.value)
                  }
                  placeholder="Enter your store name"
                />
              </div>

              <div className="designer-row">
                <div className="designer-row-label">
                  <label htmlFor="designerDescription">
                    Description
                  </label>

                  <p>
                    A short message explaining your store.
                  </p>
                </div>

                <textarea
                  id="designerDescription"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Describe your store"
                  maxLength="300"
                />
              </div>
            </section>

            <section className="designer-section">
              <div className="designer-section-heading">
                <span>02</span>

                <div>
                  <h2>Store images</h2>

                  <p>
                    Add a logo and cover image for your storefront.
                  </p>
                </div>
              </div>

              <div className="designer-row">
                <div className="designer-row-label">
                  <label htmlFor="designerLogo">
                    Store logo
                  </label>

                  <p>
                    Choose a square image for the best result.
                  </p>
                </div>

                <div className="designer-upload">
                  <input
                    id="designerLogo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFile}
                  />

                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="designer-logo-preview"
                    />
                  ) : (
                    <div className="designer-upload-placeholder">
                      No logo selected
                    </div>
                  )}
                </div>
              </div>

              <div className="designer-row">
                <div className="designer-row-label">
                  <label htmlFor="designerCover">
                    Cover image
                  </label>

                  <p>
                    Choose a wide image for the store header.
                  </p>
                </div>

                <div className="designer-upload">
                  <input
                    id="designerCover"
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFile}
                  />

                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="designer-cover-preview"
                    />
                  ) : (
                    <div className="designer-upload-placeholder cover">
                      No cover image selected
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="designer-section">
              <div className="designer-section-heading">
                <span>03</span>

                <div>
                  <h2>Choose a template</h2>

                  <p>
                    Select the overall style of your storefront.
                  </p>
                </div>
              </div>

              <div className="designer-template-grid">
                {templates.map((templateOption) => (
                  <button
                    key={templateOption.id}
                    type="button"
                    className={
                      template === templateOption.id
                        ? "designer-template-option active"
                        : "designer-template-option"
                    }
                    onClick={() =>
                      setTemplate(templateOption.id)
                    }
                  >
                    <div
                      className={`designer-template-thumbnail ${templateOption.id}`}
                    >
                      <span />
                      <span />
                      <span />
                    </div>

                    <strong>{templateOption.name}</strong>

                    <p>{templateOption.description}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="designer-section">
              <div className="designer-section-heading">
                <span>04</span>

                <div>
                  <h2>Store colors</h2>

                  <p>
                    Choose colors for your buttons, background,
                    and text.
                  </p>
                </div>
              </div>

              <div className="designer-color-list">
                <div className="designer-color-row">
                  <div>
                    <label htmlFor="primaryColor">
                      Primary color
                    </label>

                    <p>Buttons and important details.</p>
                  </div>

                  <div className="designer-color-control">
                    <input
                      id="primaryColor"
                      type="color"
                      value={primaryColor}
                      onChange={(event) =>
                        setPrimaryColor(event.target.value)
                      }
                    />

                    <strong>
                      {primaryColor.toUpperCase()}
                    </strong>
                  </div>
                </div>

                <div className="designer-color-row">
                  <div>
                    <label htmlFor="backgroundColor">
                      Background color
                    </label>

                    <p>The main storefront background.</p>
                  </div>

                  <div className="designer-color-control">
                    <input
                      id="backgroundColor"
                      type="color"
                      value={backgroundColor}
                      onChange={(event) =>
                        setBackgroundColor(event.target.value)
                      }
                    />

                    <strong>
                      {backgroundColor.toUpperCase()}
                    </strong>
                  </div>
                </div>

                <div className="designer-color-row">
                  <div>
                    <label htmlFor="textColor">
                      Text color
                    </label>

                    <p>Headings and storefront text.</p>
                  </div>

                  <div className="designer-color-control">
                    <input
                      id="textColor"
                      type="color"
                      value={textColor}
                      onChange={(event) =>
                        setTextColor(event.target.value)
                      }
                    />

                    <strong>
                      {textColor.toUpperCase()}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="designer-section">
              <div className="designer-section-heading">
                <span>05</span>

                <div>
                  <h2>Product card style</h2>

                  <p>
                    Choose the shape used for product cards.
                  </p>
                </div>
              </div>

              <div className="designer-card-style-grid">
                {cardStyles.map((styleOption) => (
                  <button
                    key={styleOption.id}
                    type="button"
                    className={
                      cardStyle === styleOption.id
                        ? "designer-card-style active"
                        : "designer-card-style"
                    }
                    onClick={() =>
                      setCardStyle(styleOption.id)
                    }
                  >
                    <span
                      style={{
                        borderRadius:
                          styleOption.id === "square"
                            ? "0px"
                            : styleOption.id === "soft"
                              ? "8px"
                              : "18px",
                      }}
                    />

                    <strong>{styleOption.name}</strong>
                  </button>
                ))}
              </div>
            </section>

            <div className="designer-save-section">
              <div>
                <span>Finish editing</span>

                <strong>Save your storefront design</strong>

                <p>
                  Your selected design will be connected to your
                  public store.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save Store Design"}
              </button>
            </div>
          </form>

          <aside className="designer-preview-panel">
            <div className="designer-preview-heading">
              <div>
                <span>Live preview</span>
                <h2>Storefront</h2>
              </div>

              <strong>{selectedTemplate.name}</strong>
            </div>

            <div
              className={getTemplateClass()}
              style={{
                backgroundColor,
                color: textColor,
              }}
            >
              <div
                className="designer-preview-hero"
                style={{
                  backgroundColor: primaryColor,
                  backgroundImage: coverPreview
                    ? `linear-gradient(
                        rgba(0, 0, 0, 0.28),
                        rgba(0, 0, 0, 0.28)
                      ), url("${coverPreview}")`
                    : "none",
                }}
              >
                <div className="designer-preview-nav">
                  <div>
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Store logo"
                      />
                    ) : (
                      <span className="designer-preview-logo-placeholder">
                        {storeName
                          ? storeName.charAt(0).toUpperCase()
                          : "S"}
                      </span>
                    )}

                    <strong>
                      {storeName || "Your Store"}
                    </strong>
                  </div>

                  <span>Menu</span>
                </div>

                <div className="designer-preview-content">
                  <span>Welcome to</span>

                  <h1>
                    {storeName || "Your Store"}
                  </h1>

                  <p>
                    {description ||
                      "Your store description will appear here."}
                  </p>

                  <button
                    type="button"
                    style={{
                      color: primaryColor,
                    }}
                  >
                    Shop now
                  </button>
                </div>
              </div>

              <div className="designer-preview-products">
                <div className="designer-preview-products-heading">
                  <div>
                    <span>Store collection</span>
                    <h2>Products</h2>
                  </div>

                  <p>
                    Your real products will appear here.
                  </p>
                </div>

                <div
                  className="designer-empty-products"
                  style={{
                    borderRadius: getCardRadius(),
                  }}
                >
                  <strong>No products yet</strong>

                  <p>
                    Add products from your Products page to see
                    them in your public store.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default StoreDesigner;