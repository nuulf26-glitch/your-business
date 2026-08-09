import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/cart.css";

function Cart() {
  const navigate = useNavigate();

  const [cart, setCart] = useState([]);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("businessCart");
      const parsedCart = savedCart ? JSON.parse(savedCart) : [];

      if (Array.isArray(parsedCart)) {
        setCart(parsedCart);
      }
    } catch (error) {
      console.error("Could not load cart:", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("businessCart", JSON.stringify(cart));
  }, [cart]);

  const subtotal = useMemo(() => {
    return cart.reduce((total, item) => {
      return total + Number(item.price) * Number(item.quantity);
    }, 0);
  }, [cart]);

  const totalItems = useMemo(() => {
    return cart.reduce((total, item) => {
      return total + Number(item.quantity);
    }, 0);
  }, [cart]);

  function updateQuantity(productId, newQuantity) {
    if (newQuantity < 1) {
      return;
    }

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: newQuantity,
            }
          : item
      )
    );
  }

  function removeItem(productId) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.productId !== productId)
    );
  }

  function clearCart() {
    const confirmed = window.confirm(
      "Are you sure you want to remove all items from your cart?"
    );

    if (!confirmed) {
      return;
    }

    setCart([]);
  }

  return (
    <div className="cart-page">
      <header className="cart-header">
        <button
          type="button"
          className="cart-logo"
          onClick={() => navigate("/")}
        >
          Your Business
        </button>

        <button
          type="button"
          className="cart-continue-button"
          onClick={() => navigate(-1)}
        >
          Continue shopping
        </button>
      </header>

      <main className="cart-main">
        <div className="cart-heading">
          <span>Your order</span>
          <h1>Shopping cart</h1>
          <p>
            Review your items and quantities before continuing to checkout.
          </p>
        </div>

        {cart.length === 0 ? (
          <section className="cart-empty-state">
            <div className="cart-empty-icon">0</div>

            <h2>Your cart is empty</h2>

            <p>
              Add products from the store before continuing to checkout.
            </p>

            <button type="button" onClick={() => navigate(-1)}>
              Continue shopping
            </button>
          </section>
        ) : (
          <div className="cart-layout">
            <section className="cart-items-card">
              <div className="cart-items-heading">
                <div>
                  <span>Cart items</span>
                  <h2>{totalItems} items</h2>
                </div>

                <button type="button" onClick={clearCart}>
                  Clear cart
                </button>
              </div>

              <div className="cart-items-list">
                {cart.map((item) => (
                  <article className="cart-item" key={item.productId}>
                    <div className="cart-item-image">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} />
                      ) : (
                        <span>
                          {item.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="cart-item-content">
                      <div className="cart-item-title">
                        <div>
                          <span>{item.category || "Product"}</span>
                          <h3>{item.name}</h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="cart-item-bottom">
                        <div className="cart-quantity-control">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.quantity - 1
                              )
                            }
                          >
                            −
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.quantity + 1
                              )
                            }
                          >
                            +
                          </button>
                        </div>

                        <div className="cart-item-price">
                          <span>
                            USD {Number(item.price).toFixed(2)} each
                          </span>

                          <strong>
                            USD{" "}
                            {(
                              Number(item.price) *
                              Number(item.quantity)
                            ).toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="cart-summary-card">
              <div className="cart-summary-heading">
                <span>Order summary</span>
                <h2>Your total</h2>
              </div>

              <div className="cart-summary-row">
                <span>Items</span>
                <strong>{totalItems}</strong>
              </div>

              <div className="cart-summary-row">
                <span>Subtotal</span>
                <strong>USD {subtotal.toFixed(2)}</strong>
              </div>

              <div className="cart-summary-row">
                <span>Shipping</span>
                <strong>Calculated at checkout</strong>
              </div>

              <div className="cart-summary-total">
                <span>Total</span>
                <strong>USD {subtotal.toFixed(2)}</strong>
              </div>

              <button
                type="button"
                className="cart-checkout-button"
                onClick={() => navigate("/checkout")}
              >
                Continue to checkout
              </button>

              <button
                type="button"
                className="cart-shopping-button"
                onClick={() => navigate(-1)}
              >
                Continue shopping
              </button>

              <p>
                Taxes, shipping, and payment fees may be added during
                checkout.
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export default Cart;