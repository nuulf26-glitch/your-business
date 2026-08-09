import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  addProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} from "../services/productService";

import "../styles/products.css";

const emptyForm = {
  name: "",
  sellingPrice: "",
  costPrice: "",
  category: "",
  stock: "",
  description: "",
  imageUrl: "",
  imageName: "",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState("All");
  const [imageError, setImageError] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
  async function loadProducts() {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error) {
      console.error("Could not load products:", error);
    }
  }

  loadProducts();
}, []);



  const categories = useMemo(() => {
    const uniqueCategories = products
      .map((product) => product.category)
      .filter(Boolean);

    return ["All", ...new Set(uniqueCategories)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return products.filter((product) => {
      const productName = (
        product.name || ""
      ).toLowerCase();

      const productCategory = (
        product.category || ""
      ).toLowerCase();

      const matchesSearch =
        productName.includes(normalizedSearch) ||
        productCategory.includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === "All" ||
        product.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const totals = useMemo(() => {
    return products.reduce(
      (result, product) => {
        const sellingPrice =
          Number(product.sellingPrice) || 0;

        const costPrice =
          Number(product.costPrice) || 0;

        const stock =
          Number(product.stock) || 0;

        result.inventoryValue +=
          costPrice * stock;

        result.potentialRevenue +=
          sellingPrice * stock;

        result.potentialProfit +=
          (sellingPrice - costPrice) * stock;

        return result;
      },
      {
        inventoryValue: 0,
        potentialRevenue: 0,
        potentialProfit: 0,
      }
    );
  }, [products]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    setImageError("");

    if (!file) {
      return;
    }

    const acceptedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!acceptedTypes.includes(file.type)) {
      setImageError(
        "Please choose a PNG, JPG, or WEBP image."
      );

      event.target.value = "";
      return;
    }

    const maximumSize = 1024 * 1024;

    if (file.size > maximumSize) {
      setImageError(
        "The image must be smaller than 1 MB."
      );

      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setImageError(
          "The image could not be loaded."
        );

        return;
      }

      setForm((current) => ({
        ...current,
        imageUrl: reader.result,
        imageName: file.name,
      }));
    };

    reader.onerror = () => {
      setImageError(
        "The image could not be loaded. Please try again."
      );
    };

    reader.readAsDataURL(file);
  }

  function removeImage() {
    setForm((current) => ({
      ...current,
      imageUrl: "",
      imageName: "",
    }));

    setImageError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setImageError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event) {
  event.preventDefault();

    if (
      !form.name.trim() ||
      form.sellingPrice === "" ||
      !form.category.trim() ||
      form.stock === ""
    ) {
      alert(
        "Please complete all required fields."
      );

      return;
    }

    const sellingPrice =
      Number(form.sellingPrice);

    const costPrice =
      Number(form.costPrice) || 0;

    const stock =
      Number(form.stock);

    if (sellingPrice < 0) {
      alert(
        "Selling price cannot be negative."
      );

      return;
    }

    if (costPrice < 0) {
      alert(
        "Cost price cannot be negative."
      );

      return;
    }

    if (stock < 0) {
      alert(
        "Stock quantity cannot be negative."
      );

      return;
    }

    const existingProduct = editingId
      ? products.find(
          (product) =>
            product.id === editingId
        )
      : null;

    const productData = {
      id:
        editingId ||
        crypto.randomUUID(),
storeUrl: JSON.parse(
  localStorage.getItem("websiteSetup")
)?.storeUrl,
      name: form.name.trim(),

      sellingPrice,

      costPrice,

      category: form.category.trim(),

      stock,
      storeUrl: localStorage.getItem("storeUrl") || "",

      description:
        form.description.trim(),

      imageUrl: form.imageUrl,

      imageName: form.imageName,

      createdAt:
        existingProduct?.createdAt ||
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),
    };

    try {
  if (editingId) {
    await updateProduct(editingId, productData);

    setProducts((current) =>
      current.map((product) =>
        product.id === editingId
          ? productData
          : product
      )
    );
  } else {
    const newId = await addProduct(productData);

const updatedProducts = await getProducts();
setProducts(updatedProducts);
  }

  resetForm();

} catch (error) {
  console.error("Could not save product:", error);
  alert("Something went wrong while saving product.");
}
  }

  function handleEdit(product) {
    setEditingId(product.id);
    setImageError("");

    setForm({
      name: product.name || "",

      sellingPrice: String(
        product.sellingPrice ?? ""
      ),

      costPrice: String(
        product.costPrice ?? ""
      ),

      category: product.category || "",

      stock: String(
        product.stock ?? ""
      ),

      description:
        product.description || "",

      imageUrl:
        product.imageUrl || "",

      imageName:
        product.imageName || "",
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleDelete(productId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this product?"
    );

    if (!confirmed) {
      return;
    }

         async function handleDelete(productId) {
  const confirmed = window.confirm(
    "Are you sure you want to delete this product?"
  );

  if (!confirmed) return;

  try {
    await deleteProduct(productId);

    setProducts((current) =>
      current.filter(
        (product) => product.id !== productId
      )
    );

  } catch (error) {
    console.error("Could not delete product:", error);
    alert("Could not delete product.");
  }
}

    if (editingId === productId) {
      resetForm();
    }
  }

  function calculateProfit(product) {
    return (
      Number(product.sellingPrice) -
      Number(product.costPrice || 0)
    );
  }

  function calculateMargin(product) {
    const sellingPrice =
      Number(product.sellingPrice) || 0;

    const profit =
      calculateProfit(product);

    if (sellingPrice <= 0) {
      return 0;
    }

    return (
      (profit / sellingPrice) *
      100
    );
  }

  return (
    <div className="products-page">
      <header className="products-header">
        <div>
          <span>Inventory management</span>

          <h1>Products</h1>

          <p>
            Add products, track stock, and
            see your cost, profit, and
            selling price clearly.
          </p>
        </div>
      </header>

      <section className="products-summary-grid">
        <article>
          <span>Total products</span>

          <strong>
            {products.length}
          </strong>

          <p>
            Products currently added
          </p>
        </article>

        <article>
          <span>Inventory cost</span>

          <strong>
            {formatCurrency(
              totals.inventoryValue
            )}
          </strong>

          <p>
            Total cost value of current
            stock
          </p>
        </article>

        <article>
          <span>Potential revenue</span>

          <strong>
            {formatCurrency(
              totals.potentialRevenue
            )}
          </strong>

          <p>
            Revenue if all stock is sold
          </p>
        </article>

        <article>
          <span>Potential profit</span>

          <strong>
            {formatCurrency(
              totals.potentialProfit
            )}
          </strong>

          <p>
            Estimated profit from current
            stock
          </p>
        </article>
      </section>

      <section className="products-layout">
        <article className="product-form-card">
          <div className="product-card-heading">
            <span>
              {editingId
                ? "Edit product"
                : "New product"}
            </span>

            <h2>
              {editingId
                ? "Update product details"
                : "Add a product"}
            </h2>
          </div>

          <form
            className="product-form"
            onSubmit={handleSubmit}
          >
            <div className="product-field">
              <label htmlFor="name">
                Product name *
              </label>

              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter the product name"
              />
            </div>

            <div className="product-form-grid">
              <div className="product-field">
                <label htmlFor="sellingPrice">
                  Selling price *
                </label>

                <div className="product-money-field">
                  <span>$</span>

                  <input
                    id="sellingPrice"
                    name="sellingPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.sellingPrice
                    }
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="product-field">
                <label htmlFor="costPrice">
                  Cost price
                </label>

                <div className="product-money-field">
                  <span>$</span>

                  <input
                    id="costPrice"
                    name="costPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costPrice}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="product-form-grid">
              <div className="product-field">
                <label htmlFor="category">
                  Category *
                </label>

                <input
                  id="category"
                  name="category"
                  type="text"
                  value={form.category}
                  onChange={handleChange}
                  placeholder="Beauty, Fashion, Home..."
                />
              </div>

              <div className="product-field">
                <label htmlFor="stock">
                  Stock quantity *
                </label>

                <input
                  id="stock"
                  name="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="product-field">
              <label htmlFor="productImage">
                Product image
              </label>

              <input
                ref={fileInputRef}
                id="productImage"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
              />

              <small>
                PNG, JPG, or WEBP. Maximum
                file size: 1 MB.
              </small>

              {imageError && (
                <p className="product-image-error">
                  {imageError}
                </p>
              )}

              {form.imageUrl && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    marginTop: "12px",
                    padding: "12px",
                    border:
                      "1px solid #deded9",
                    borderRadius: "12px",
                  }}
                >
                  <img
                    src={form.imageUrl}
                    alt="Product preview"
                    style={{
                      width: "82px",
                      height: "82px",
                      borderRadius: "10px",
                      objectFit: "cover",
                    }}
                  />

                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow:
                          "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {form.imageName ||
                        "Selected image"}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="product-cancel-button"
                    onClick={removeImage}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="product-field">
              <label htmlFor="description">
                Description
              </label>

              <textarea
                id="description"
                name="description"
                rows="5"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe your product."
              />
            </div>

            <div className="product-form-actions">
              {editingId && (
                <button
                  type="button"
                  className="product-cancel-button"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                className="product-save-button"
              >
                {editingId
                  ? "Save changes"
                  : "Add product"}
              </button>
            </div>
          </form>
        </article>

        <article className="products-list-card">
          <div className="products-list-heading">
            <div>
              <span>Inventory</span>

              <h2>Your products</h2>
            </div>

            <strong>
              {filteredProducts.length} shown
            </strong>
          </div>

          <div className="products-tools">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search products..."
            />

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
            >
              {categories.map(
                (category) => (
                  <option
                    value={category}
                    key={category}
                  >
                    {category}
                  </option>
                )
              )}
            </select>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="products-empty-state">
              <h3>No products found</h3>

              <p>
                Add your first product or
                change your search filters.
              </p>
            </div>
          ) : (
            <div className="products-list">
              {filteredProducts.map(
                (product) => {
                  const profit =
                    calculateProfit(product);

                  const margin =
                    calculateMargin(product);

                  return (
                    <article
                      className="product-list-item"
                      key={product.id}
                    >
                      <div className="product-list-image">
                        {product.imageUrl ? (
                          <img
                            src={
                              product.imageUrl
                            }
                            alt={product.name}
                          />
                        ) : (
                          <span>
                            No image
                          </span>
                        )}
                      </div>

                      <div className="product-list-content">
                        <div className="product-list-title">
                          <div>
                            <span>
                              {
                                product.category
                              }
                            </span>

                            <h3>
                              {product.name}
                            </h3>
                          </div>

                          <div className="product-list-actions">
                            <button
                              type="button"
                              onClick={() =>
                                handleEdit(
                                  product
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="delete"
                              onClick={() =>
                                handleDelete(
                                  product.id
                                )
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <p>
                          {product.description ||
                            "No product description added."}
                        </p>

                        <div className="product-numbers-grid">
                          <div>
                            <span>
                              Selling price
                            </span>

                            <strong>
                              {formatCurrency(
                                product.sellingPrice
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Cost price
                            </span>

                            <strong>
                              {formatCurrency(
                                product.costPrice
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Profit per item
                            </span>

                            <strong>
                              {formatCurrency(
                                profit
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Profit margin
                            </span>

                            <strong>
                              {margin.toFixed(
                                1
                              )}
                              %
                            </strong>
                          </div>

                          <div>
                            <span>
                              Stock
                            </span>

                            <strong>
                              {product.stock}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

export default Products;