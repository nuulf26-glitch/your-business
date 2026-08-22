import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/productPage.css";
import { getProductById } from "../services/productService";
function ProductPage() {
  const navigate = useNavigate();
  const { productId } = useParams();

  const [products, setProducts] = useState([]);
  const [quantity, setQuantity] = useState(1);
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

  function addToCart() {
    if (!product) return;

    try {
      const savedCart = localStorage.getItem("businessCart");
      const currentCart = savedCart ? JSON.parse(savedCart) : [];

      const safeCart = Array.isArray(currentCart) ? currentCart : [];

      const existingProduct = safeCart.find(
        (item) => item.productId === product.id
      );

      let updatedCart;

      if (existingProduct) {
        updatedCart = safeCart.map((item) =>
          item.productId === product.id
            ? {
                ...item,
quantity: Math.min(
  Number(product.stock),
  item.quantity + quantity
),              }
            : item
        );
      } else {
        updatedCart = [
          ...safeCart,
          {
            productId: product.id,
            name: product.name,
            price: Number(product.sellingPrice),
            imageUrl: product.imageUrl || "",
            category: product.category || "",
            quantity,
          },
        ];
      }

      localStorage.setItem("businessCart", JSON.stringify(updatedCart));

      setAdded(true);

      window.setTimeout(() => {
        setAdded(false);
      }, 1800);
    } catch (error) {
      console.error("Could not add product to cart:", error);
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
          Your Business
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
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} />
            ) : (
              <span>{product.name.charAt(0).toUpperCase()}</span>
            )}
          </div>

          <div className="product-page-content">
            <span className="product-page-category">
              {product.category}
            </span>

            <h1>{product.name}</h1>

            <p className="product-page-price">
              USD {Number(product.sellingPrice).toFixed(2)}
            </p>

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
                {Number(product.stock) > 0
                  ? `${product.stock} in stock`
                  : "Out of stock"}
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
                        Number(product.stock) || 99,
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
                disabled={Number(product.stock) <= 0}
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