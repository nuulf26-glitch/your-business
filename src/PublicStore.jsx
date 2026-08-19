import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import "./styles/publicStore.css";

import { getStoreByUrl } from "./services/storeService";
import { getProductsByStore } from "./services/productService";

function PublicStore() {
  const navigate = useNavigate();
  const { storeUrl } = useParams();

  const [websiteSetup, setWebsiteSetup] = useState(null);
  const [editorData, setEditorData] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    async function loadStore() {
      try {
        // Load store information from Firebase
        const store = await getStoreByUrl(storeUrl);

        if (store) {
          setWebsiteSetup(store);
        }

      
        if (store) {
  setWebsiteSetup(store);
}

        // Load products belonging to this store
        const storeProducts =
          await getProductsByStore(storeUrl);

        setProducts(storeProducts);
      } catch (error) {
        console.error(
          "Could not load public store:",
          error
        );
      }
    }

    if (storeUrl) {
      loadStore();
    }
  }, [storeUrl]);

  const brandName =
    editorData?.brandName ||
    websiteSetup?.businessName ||
    websiteSetup?.storeName ||
    "Your Business";

  const template =
    editorData?.template ||
    websiteSetup?.template ||
    localStorage.getItem("selectedTemplate") ||
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

  function openProduct(productId) {
    navigate(`/product/${productId}`);
  }

  if (!storeMatches) {
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

                    <p>
                      {Number(
                        product.sellingPrice
                      ).toFixed(2)}
                    </p>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openProduct(product.id);
                      }}
                    >
                      View product
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

const websiteId = store?.businessName
  ?.toLowerCase()
  .replace(/\s+/g, "-");


if (websiteId) {

  const websiteRef = doc(
    db,
    "websites",
    websiteId
  );

  const websiteSnap = await getDoc(websiteRef);


  if (websiteSnap.exists()) {

    setEditorData(
      websiteSnap.data()
    );

  }

}
export default PublicStore;
``
