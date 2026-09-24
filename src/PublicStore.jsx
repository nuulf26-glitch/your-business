import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import "./styles/publicStore.css";

import { getStoreByUrl } from "./services/storeService";
import { getProductsByStore } from "./services/productService";

function formatUsd(value) {
  const amount = Number(value);
  return `$${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function PublishedWebsite({ editorData, products, addToCart, navigate }) {
  const sections = editorData.sections || editorData.elements || [];
  const primaryColor = editorData.primaryColor || "#18243a";
  const backgroundColor = editorData.backgroundColor || "#f7f2eb";
  const brandName = editorData.brandName || "Your Business";

  function renderSection(section, index) {
    const style = {
      "--published-color": section.style?.color || "#171513",
      "--published-font": section.style?.fontFamily || "Georgia",
      "--published-size": `${section.style?.fontSize || 32}px`,
    };
    const sectionId = `published-${section.type}-${index}`;

    if (section.type === "hero") {
      return <section id={sectionId} className="published-section published-hero" style={style} key={section.id}><div><p className="published-eyebrow">Built for your next chapter</p><h1>{section.title}</h1><p>{section.body}</p><button type="button" onClick={() => document.getElementById("published-products")?.scrollIntoView({ behavior: "smooth" })} style={{ backgroundColor: primaryColor }}>{section.buttonText || "Get started"}</button></div><div className={`published-hero-media${section.image ? " has-image" : ""}`} style={section.image ? { backgroundImage: `url(${section.image})` } : undefined}>{!section.image && <span>{brandName}</span>}</div></section>;
    }
    if (section.type === "about") {
      return <section id={sectionId} className="published-section published-about" style={style} key={section.id}><div className={`published-about-media${section.image ? " has-image" : ""}`} style={section.image ? { backgroundImage: `url(${section.image})` } : undefined}>{!section.image && <span>Our story</span>}</div><div><p className="published-eyebrow">About us</p><h2>{section.title}</h2><p>{section.body}</p><button className="published-outline-button" type="button">{section.buttonText || "Learn more"}</button></div></section>;
    }
    if (section.type === "services") {
      return <section id={sectionId} className="published-section published-standard" style={style} key={section.id}><p className="published-eyebrow">What we offer</p><h2>{section.title}</h2><p>{section.body}</p><div className="published-services">{(section.items || []).map((item, itemIndex) => <article key={`${item}-${itemIndex}`}><span>0{itemIndex + 1}</span><h3>{item}</h3><p>Made with care and tailored to you.</p></article>)}</div></section>;
    }
    if (section.type === "menu") {
      return <section id={sectionId} className="published-section published-standard published-menu" style={style} key={section.id}><p className="published-eyebrow">Menu</p><h2>{section.title}</h2><p>{section.body}</p><div>{(section.items || []).map((item, itemIndex) => <p key={`${item.name}-${itemIndex}`}><span>{item.name}</span><b>{item.price}</b></p>)}</div></section>;
    }
    if (section.type === "booking") {
      return <section id={sectionId} className="published-section published-booking" style={style} key={section.id}><div><p className="published-eyebrow">Appointments</p><h2>{section.title}</h2><p>{section.body}</p></div><div className="published-booking-card"><span>Choose a time</span><div><i>10:00</i><i>12:00</i><i>15:30</i></div><button type="button">{section.buttonText || "Book now"}</button></div></section>;
    }
    if (section.type === "gallery") {
      return <section id={sectionId} className="published-section published-standard" style={style} key={section.id}><p className="published-eyebrow">Gallery</p><h2>{section.title}</h2><p>{section.body}</p><div className="published-gallery">{(section.images || ["", "", ""]).map((image, imageIndex) => <div key={`${image}-${imageIndex}`} className={image ? "has-image" : ""} style={image ? { backgroundImage: `url(${image})` } : undefined}>{!image && <span>Photo {imageIndex + 1}</span>}</div>)}</div></section>;
    }
    if (section.type === "faq") {
      return <section id={sectionId} className="published-section published-standard published-faq" style={style} key={section.id}><p className="published-eyebrow">FAQ</p><h2>{section.title}</h2><p>{section.body}</p><div>{(section.items || []).map((item, itemIndex) => <details key={`${item.question}-${itemIndex}`} open={itemIndex === 0}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div></section>;
    }
    if (section.type === "product") {
      const linkedProduct = products.find((product) => String(product.id) === String(section.productId));
      return <section id={sectionId} className="published-section published-product" style={style} key={section.id}><div className={`published-product-image${section.image ? " has-image" : ""}`} style={section.image ? { backgroundImage: `url(${section.image})` } : undefined}>{!section.image && <span>Product</span>}</div><div><p className="published-eyebrow">Featured product</p><h2>{section.title}</h2><p>{section.body}</p><strong>{formatUsd(section.price)}</strong><button type="button" style={{ backgroundColor: primaryColor }} disabled={!linkedProduct} onClick={() => linkedProduct && addToCart(linkedProduct)}>Add to cart</button></div></section>;
    }
    if (section.type === "heading") return <section id={sectionId} className="published-section published-simple" style={style} key={section.id}><h2>{section.title}</h2></section>;
    if (section.type === "text") return <section id={sectionId} className="published-section published-simple published-text" style={style} key={section.id}><p>{section.body}</p></section>;
    if (section.type === "button") return <section id={sectionId} className="published-section published-simple published-button" style={style} key={section.id}><button type="button" style={{ backgroundColor: primaryColor }}>{section.buttonText || section.title}</button></section>;
    if (section.type === "photo") return <section id={sectionId} className={`published-section published-photo${section.image ? " has-image" : ""}`} style={section.image ? { ...style, backgroundImage: `url(${section.image})` } : style} key={section.id}>{!section.image && <><h2>{section.title}</h2><p>{section.body}</p></>}</section>;
    if (section.type === "chat") return <section id={sectionId} className="published-section published-chat" style={style} key={section.id}><span>✦</span><div><b>{section.title}</b><small>{section.body}</small></div><a href={`mailto:${section.email || "hello@example.com"}`}>Chat</a></section>;
    return <footer id={sectionId} className="published-section published-footer" style={style} key={section.id}><div><h2>{section.title}</h2><p>{section.body}</p></div><span>© {new Date().getFullYear()} {brandName}</span></footer>;
  }

  const hasProductSection = sections.some((section) => section.type === "product");

  return <div className="published-cyb-store" style={{ "--published-primary": primaryColor, "--published-background": backgroundColor }}>
    <header className="published-navbar"><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>{brandName}</button><nav><button type="button" onClick={() => document.getElementById("published-products")?.scrollIntoView({ behavior: "smooth" })}>Shop</button><button type="button" onClick={() => document.getElementById("published-about")?.scrollIntoView({ behavior: "smooth" })}>About</button><button type="button" onClick={() => document.getElementById("published-contact")?.scrollIntoView({ behavior: "smooth" })}>Contact</button></nav><button type="button" className="published-cart" onClick={() => navigate("/cart")}>Cart</button></header>
    <main>{sections.map(renderSection)}{!hasProductSection && products.length > 0 && <section id="published-products" className="published-section published-catalog"><p className="published-eyebrow">Our products</p><h2>Shop the collection</h2><div>{products.map((product) => <article key={product.id}><div className={product.imageUrl ? "has-image" : ""} style={product.imageUrl ? { backgroundImage: `url(${product.imageUrl})` } : undefined}>{!product.imageUrl && <span>{product.name?.slice(0, 1)}</span>}</div><h3>{product.name}</h3><p>{product.description}</p><strong>{formatUsd(product.sellingPrice)}</strong><button type="button" style={{ backgroundColor: primaryColor }} disabled={product.stock <= 0} onClick={() => addToCart(product)}>{product.stock > 0 ? "Add to cart" : "Out of stock"}</button></article>)}</div></section>}<section id="published-about" className="published-store-about"><p className="published-eyebrow">Our story</p><h2>{editorData.aboutTitle || "Made with purpose."}</h2><p>{editorData.description || "Tell customers what makes your business different."}</p></section><section id="published-contact" className="published-contact"><div><p className="published-eyebrow">Contact us</p><h2>Have a question?</h2><p>We would love to hear from you.</p></div><a href="mailto:hello@example.com" style={{ backgroundColor: primaryColor }}>Send a message</a></section></main>
  </div>;
}

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
  setEditorData(store.editorData || store);
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
function addToCart(product) {
  const savedCart =
    JSON.parse(
      localStorage.getItem("businessCart")
    ) || [];

  const existingProduct = savedCart.find(
    (item) =>
      item.productId === product.id
  );

  let updatedCart;

  if (existingProduct) {
    updatedCart = savedCart.map((item) =>
      item.productId === product.id
        ? {
            ...item,
            quantity:
              item.quantity + 1,
          }
        : item
    );
  } else {
    updatedCart = [
      ...savedCart,
      {
        productId: product.id,
        name: product.name,
        price: product.sellingPrice,
        quantity: 1,
        imageUrl: product.imageUrl,
        category: product.category,
        storeUrl: product.storeUrl,
      },
    ];
  }

  localStorage.setItem(
    "businessCart",
    JSON.stringify(updatedCart)
  );

  alert("Added to cart");
}

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

  if (editorData?.editorVersion === 2) {
    return (
      <PublishedWebsite
        editorData={editorData}
        products={products}
        addToCart={addToCart}
        navigate={navigate}
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
