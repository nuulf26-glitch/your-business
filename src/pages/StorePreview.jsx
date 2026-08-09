import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { getStore } from "../services/storeService";
import { getProducts } from "../services/productService";

function StorePreview() {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    async function loadStorePreview() {
      const storeData = await getStore();
      const productsData = await getProducts();

      setStore(storeData);
      setProducts(productsData);
    }

    loadStorePreview();
  }, []);

  return (
    <DashboardLayout>
      <h1>Store Preview</h1>

      <div
        style={{
          background: "white",
          borderRadius: "22px",
          overflow: "hidden",
          marginTop: "30px",
          boxShadow: "0 10px 30px rgba(0,0,0,.08)",
        }}
      >
        <section
          style={{
            padding: "70px 30px",
            textAlign: "center",
            background: store?.themeColor || "#6D28D9",
            color: "white",
          }}
        >
          <h1 style={{ fontSize: "48px" }}>
            {store?.storeName || "Your Store"}
          </h1>

          <p style={{ marginTop: "15px", fontSize: "18px" }}>
            {store?.description || "Welcome to our online store."}
          </p>
        </section>

        <section style={{ padding: "40px" }}>
          <h2>Products</h2>

          <div style={productsGrid}>
            {products.length === 0 ? (
              <p>No products yet.</p>
            ) : (
              products.map((product) => (
                <div key={product.id} style={productCard}>
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      style={productImage}
                    />
                  )}

                  <h3>{product.name}</h3>
                  <p>{product.price} USD</p>
                  <p style={{ color: "#6b7280" }}>
                    {product.description}
                  </p>

                  <button
                    style={{
                      width: "100%",
                      marginTop: "15px",
                      padding: "13px",
                      border: "none",
                      borderRadius: "10px",
                      background: store?.themeColor || "#6D28D9",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    Add to Cart
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

const productsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "25px",
  marginTop: "30px",
};

const productCard = {
  border: "1px solid #eee",
  padding: "20px",
  borderRadius: "16px",
};

const productImage = {
  width: "100%",
  height: "200px",
  objectFit: "cover",
  borderRadius: "12px",
  marginBottom: "15px",
};

export default StorePreview;