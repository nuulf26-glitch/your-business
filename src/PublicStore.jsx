import { readCart, appendCart } from "./services/cartPolicy";
import PickupWidget from "./business/PickupWidget";
import { productPrice } from "./services/productPolicy";
import BookingWidget from "./business/BookingWidget";
import { businessCall } from "./business/api";
import WebsiteRenderer from "./editor/WebsiteRenderer";
import { publishedWebsite } from "./editor/publishing";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import "./styles/publicStore.css";

import { getProductsByStore } from "./services/productService";

function PublicStore() {
  const navigate = useNavigate();
  const { storeUrl, "*": pageSlug = "" } = useParams();

  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [websiteSetup, setWebsiteSetup] = useState(null);
  const [editorData, setEditorData] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let active = true;
    setCatalog(null);
    businessCall('businessCatalog', { storeUrl }).then(value => { if (active) setCatalog(value); }).catch(() => {});
    return () => { active = false; };
  }, [storeUrl]);

  useEffect(() => {
    let active = true;
    async function loadStore() {
      setLoading(true);
      setLoadError(false);
      setWebsiteSetup(null);
      setEditorData(null);
      setProducts([]);
      try {
        // Load store information from Firebase
        const published = await businessCall("loadPublishedWebsite", { slug: storeUrl });
        const store = published ? { storeUrl, editorData: published.model, published: true } : null;

        

      
        if (!active) return;
        if (store) {
  setWebsiteSetup(store);
  setEditorData(publishedWebsite(store));
}

        // Load products belonging to this store
        const storeProducts =
          await getProductsByStore(storeUrl);

        if (active) setProducts(storeProducts);
      } catch (error) {
        if (active) setLoadError(true);
        console.error(
          "Could not load public store:",
          error
        );
      } finally { if (active) setLoading(false); }
    }

    if (storeUrl) {
      loadStore();
    }
    return () => { active = false; };
  }, [storeUrl]);

  useEffect(() => {
    if (!catalog?.analyticsEnabled || loading || !editorData) return;
    try {
      let sessionId = sessionStorage.getItem(`getcyb-visit:${storeUrl}`);
      if (!sessionId) { sessionId = crypto.randomUUID?.() || `visit-${Date.now()}-${Math.random().toString(16).slice(2)}`; sessionStorage.setItem(`getcyb-visit:${storeUrl}`,sessionId); }
      businessCall('recordPageView',{storeUrl,sessionId,page:pageSlug || '/',referrer:document.referrer}).catch(() => {});
    } catch { /* Analytics never prevents the website from loading. */ }
  },[catalog?.analyticsEnabled,loading,editorData,storeUrl,pageSlug]);

  const brandName =
    editorData?.brandName ||
    websiteSetup?.businessName ||
    websiteSetup?.storeName ||
    "Your Business";

  const template =
    editorData?.template ||
    websiteSetup?.template ||
    "minimal";

  const primaryColor =
    editorData?.primaryColor ||
    websiteSetup?.primaryColor ||
    websiteSetup?.themeColor ||
    "#111111";

  const backgroundColor =
    editorData?.backgroundColor ||
    "#f3efe8";

  const storeMatches = useMemo(() => {
    if (!websiteSetup?.storeUrl) {
      return true;
    }

    return websiteSetup.storeUrl === storeUrl;
  }, [websiteSetup, storeUrl]);
function addToCart(product) {
  try { localStorage.setItem('businessCart',JSON.stringify(appendCart(readCart(localStorage),{...product,price:productPrice(product)}))); alert('Added to cart'); }
  catch(error) { alert(error.message); }
}

  function openProduct(productId) {
    navigate(`/product/${productId}`);
  }

  if (loading) return <main role="status">Loading website…</main>;
  if (loadError) return <main role="alert">Could not load this website. Please try again.</main>;

  if (!storeMatches || !websiteSetup || !editorData) {
    return (
      <div className="public-store-not-found">
        <h1>Store not found</h1>

        <p>
          This store address does not exist.
        </p>

        <button
          type="button"
          onClick={() => navigate("/")}
        >
          Go home
        </button>
      </div>
    );
  }

  // Treat structured sections/pages as the new editor format even if an older
  // publishing endpoint omitted editorVersion. Never show the legacy template
  // in place of a real website design.
  const structuredWebsite = Array.isArray(editorData?.sections) ||
    (Array.isArray(editorData?.pages) && editorData.pages.some(page => Array.isArray(page.sections)));
  if (editorData?.editorVersion === 2 || structuredWebsite) {
    return (
      <WebsiteRenderer
        model={{ ...editorData, editorVersion: 2 }}
        baseUrl={`/store/${storeUrl}`}
        slug={pageSlug}
        catalog={catalog}
        pickup={catalog ? <PickupWidget storeUrl={storeUrl} catalog={catalog} /> : null}
        booking={catalog ? <BookingWidget storeUrl={storeUrl} catalog={catalog} /> : null}
        submitForm={data => businessCall("submitInquiry", { ...data, storeUrl })}
        products={products}
        addToCart={addToCart}
      />
    );
  }

  return (
    <div
      className={`public-store-page template-${template}`}
      style={{
        "--store-primary": primaryColor,
        "--store-background": backgroundColor,
      }}
    >
      <header className="public-store-navbar">
        <button
          type="button"
          className="public-store-logo"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            })
          }
        >
          {brandName}
        </button>

        <nav>
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("store-products")
                ?.scrollIntoView({
                  behavior: "smooth",
                })
            }
          >
            Shop
          </button>

          <button
            type="button"
            onClick={() =>
              document
                .getElementById("store-about")
                ?.scrollIntoView({
                  behavior: "smooth",
                })
            }
          >
            About
          </button>

          <button
            type="button"
            onClick={() =>
              document
                .getElementById("store-contact")
                ?.scrollIntoView({
                  behavior: "smooth",
                })
            }
          >
            Contact
          </button>
        </nav>

        <button
          type="button"
          className="public-store-cart-button"
          onClick={() => navigate("/cart")}
        >
          Cart
        </button>
      </header>

      <main>
        {(editorData?.elements || []).length > 0 && (
          <section className="public-store-designed" style={{ position: "relative" }}>
            {(editorData?.elements || []).map((element) => (
              <div
                key={element.id}
                style={{
                  position: "absolute",
                  left: element.x,
                  top: element.y,
                }}
              >
                {element.type === "heading" && (
                  <h1
                    style={{
                      fontFamily: element.style?.fontFamily,
                      fontSize: element.style?.fontSize,
                      color: element.style?.color,
                      fontWeight: element.style?.fontWeight,
                      margin: 0,
                    }}
                  >
                    {element.content}
                  </h1>
                )}
                {element.type === "text" && (
                  <p
                    style={{
                      fontFamily: element.style?.fontFamily,
                      fontSize: element.style?.fontSize,
                      color: element.style?.color,
                      fontWeight: element.style?.fontWeight,
                      margin: 0,
                    }}
                  >
                    {element.content}
                  </p>
                )}
                {element.type === "button" && (
                  <button style={{ backgroundColor: primaryColor, color: "white" }}>
                    {element.content}
                  </button>
                )}
              </div>
            ))}
          </section>
        )}
        <section className="public-store-hero">
          <div className="public-store-hero-content">
            <span>New collection</span>

            <h1>
              {editorData?.headline ||
                "Build a brand people remember."}
            </h1>

            <p>
              {editorData?.description ||
                websiteSetup?.description ||
                "Discover products created for your everyday life."}
            </p>

            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("store-products")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
            >
              {editorData?.buttonText ||
                "Shop now"}
            </button>
          </div>

          <div className="public-store-hero-image">
            <span>{brandName}</span>
          </div>
        </section>

        <section
          className="public-store-products"
          id="store-products"
        >
          <div className="public-store-section-heading">
            <span>Our products</span>

            <h2>Shop the collection</h2>

            <p>
              Browse products from {brandName} and
              choose your favorites.
            </p>
          </div>

          {products.length === 0 ? (
            <div className="public-store-empty">
              <h3>No products yet</h3>

              <p>
                This store has not added products yet.
              </p>
            </div>
          ) : (
            <div className="public-products-grid">
              {products.map((product) => (
                <article
                  className="public-product-card"
                  key={product.id}
                  onClick={() =>
                    openProduct(product.id)
                  }
                >
                  <div className="public-product-image">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                      />
                    ) : (
                      <span>
                        {product.name
                          ?.charAt(0)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="public-product-content">
                    <span>
                      {product.category}
                    </span>

                    <h3>{product.name}</h3>

<p className="public-product-description">
  {product.description}
</p>

<p className="public-product-price">
  {Number(
    product.sellingPrice
  ).toFixed(2)}
</p>

<span className="public-product-stock">
  {product.stock > 0
    ? `${product.stock} available`
    : "Out of stock"}
</span>

                    <button
  type="button"
  disabled={product.stock <= 0}
  onClick={(event) => {
    event.stopPropagation();

    if (product.stock > 0) {
     addToCart(product)

    }
  }}
>
  {product.stock > 0
    ? "Add to cart"
    : "Out of stock"}
</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section
          className="public-store-about"
          id="store-about"
        >
          <span>Our story</span>

          <h2>Made with purpose.</h2>

          <p>
            {websiteSetup?.description ||
              "Tell customers about your business, your products, and what makes your brand different."}
          </p>
        </section>

        <section
          className="public-store-contact"
          id="store-contact"
        >
          <div>
            <span>Contact us</span>

            <h2>Have a question?</h2>

            <p>
              We would love to hear from you.
            </p>
          </div>

          <a href="mailto:hello@example.com">
            Send a message
          </a>
        </section>
      </main>

      <footer className="public-store-footer">
        <strong>{brandName}</strong>

        <p>
          © 2026 {brandName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default PublicStore;
