import MediaDisplay from '../media/MediaDisplay';
import { mediaItems } from '../media/media';
import { productPrice } from "../services/productPolicy";
import { readCart, appendCart } from "../services/cartPolicy";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/productPage.css";
import { getProductById } from "../services/productService";
function ProductPage() {
  const navigate = useNavigate();
  const { productId } = useParams();

  const [products, setProducts] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [added, setAdded] = useState(false);


  useEffect(() => {
    async function loadProduct() {
      try {
        const data = await getProductById(productId);

        if (data) {
          setProducts([data]);
        }

      } catch (error) {
        console.error(
          "Could not load product:",
          error
        );
      }
    }

    loadProduct();

  }, [productId]);


  const product = useMemo(() => {
    return products.find((item) => item.id === productId);
  }, [products, productId]);

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const variantKey = variant => String(variant?.id || variant?.sku || variant?.name || "");
  const chosenVariantId = selectedVariantId || (variants.length ? variantKey(variants[0]) : "");
  const selectedVariant = variants.find(variant => variantKey(variant) === chosenVariantId);
  const selectedVariantPrice = selectedVariant?.sellingPrice ?? selectedVariant?.price;
  const purchaseProduct = selectedVariant
    ? { ...product, ...selectedVariant, ...(selectedVariantPrice !== undefined && selectedVariantPrice !== null && selectedVariantPrice !== '' ? { sellingPrice: selectedVariantPrice } : {}) }
    : product;
  const availableStock = selectedVariant?.stock ?? product?.stock;
  const hasTrackedStock = availableStock !== undefined && availableStock !== null && String(availableStock).trim() !== "";

  function addToCart() {
    if (!product) return;

    try {
      const updatedCart = appendCart(readCart(localStorage),{
        ...product,
        ...(selectedVariant ? { variantId: chosenVariantId, variantName: selectedVariant.name || selectedVariant.label || selectedVariant.sku || "Variant", sku: selectedVariant.sku || product.sku } : {}),
        price: productPrice(purchaseProduct),
        stock: availableStock,
      },quantity);
      localStorage.setItem("businessCart", JSON.stringify(updatedCart));

      setAdded(true);

      window.setTimeout(() => {
        setAdded(false);
      }, 1800);
    } catch (error) {
      alert(error.message);
    }
  }

  if (!product) {
    return (
      <div className="product-page-not-found">
        <h1>Product not found</h1>
        <p>This product does not exist or has been removed.</p>

        <button type="button" onClick={() => navigate(-1)}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="product-page">
      <header className="product-page-header">
        <button
          type="button"
          className="product-page-logo"
          onClick={() => navigate("/")}
        >
          CYB
        </button>

        <div className="product-page-header-actions">
          <button type="button" onClick={() => navigate(-1)}>
            Back to store
          </button>

          <button type="button" onClick={() => navigate("/cart")}>
            Cart
          </button>
        </div>
      </header>

      <main className="product-page-main">
        <section className="product-page-layout">
          <div className="product-page-image-card">
            {mediaItems(product).length ? <MediaDisplay value={product} title={product.name}/> : <span>{product.name.charAt(0).toUpperCase()}</span>}

          </div>

          <div className="product-page-content">
            <span className="product-page-category">
              {product.category}
            </span>

            <h1>{product.name}</h1>

            <p className="product-page-price">
              {product.currency||'USD'} {productPrice(purchaseProduct).toFixed(2)}
            </p>

            {variants.length > 0 && (
              <label className="product-variant-select">Options
                <select value={chosenVariantId} onChange={event => { setSelectedVariantId(event.target.value); setQuantity(1); }}>
                  {variants.map((variant, index) => <option key={variantKey(variant) || index} value={variantKey(variant)}>{variant.name || variant.label || variant.sku || `Option ${index + 1}`}</option>)}
                </select>
              </label>
            )}

            <div className="product-page-description">
              <h2>Product details</h2>

              <p>
                {product.description ||
                  "No product description has been added yet."}
              </p>
            </div>

            <div className="product-page-stock">
              <span>Availability</span>

              <strong>
                {!hasTrackedStock ? "Available" : Number(availableStock) > 0 ? `${availableStock} in stock` : "Out of stock"}
              </strong>
            </div>

            <div className="product-page-purchase">
              <div className="product-quantity-control">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) =>
                      Math.max(1, current - 1)
                    )
                  }
                >
                  −
                </button>

                <span>{quantity}</span>

                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) =>
                      Math.min(
                        (hasTrackedStock ? Number(availableStock) : 99) || 99,
                        current + 1
                      )
                    )
                  }
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className="product-add-cart-button"
                onClick={addToCart}
                disabled={(hasTrackedStock && Number(availableStock) <= 0) || (variants.length > 0 && !selectedVariant)}
              >
                {added ? "Added to cart" : "Add to cart"}
              </button>
            </div>

            <div className="product-page-benefits">
              <div>
                <strong>Secure checkout</strong>
                <p>Your payment information stays protected.</p>
              </div>

              <div>
                <strong>Order updates</strong>
                <p>Receive confirmation and delivery updates.</p>
              </div>

              <div>
                <strong>Customer support</strong>
                <p>Contact the store if you need help.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );


}

export default ProductPage;