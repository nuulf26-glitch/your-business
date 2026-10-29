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
import MediaFields from '../media/MediaFields';
import { mediaItems, primaryImage } from '../media/media';

const emptyForm = {
  name: "",
  sellingPrice: "",
  costPrice: "",
  category: "",
  stock: "",
  description: "",
  imageUrl: "",
  imageName: "",
  media: [],
  status: "active",
  salePrice: "",
  salePercent: "",
  hiddenUntil: "",
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
  const [mediaBusy,setMediaBusy]=useState(false);
  const [saving,setSaving]=useState(false);
  const [statusSavingId, setStatusSavingId] = useState(null);

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

  function normalizeStatus(product) {
    const hiddenUntil = product.hiddenUntil
      ? new Date(product.hiddenUntil)
      : null;

    if (
      product.status === "hidden" &&
      hiddenUntil &&
      hiddenUntil <= new Date()
    ) {
      return "active";
    }

    return product.status || "active";
  }

  async function handleStatusChange(product, nextStatus) {
    let updates = {
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    if (nextStatus === "onSale") {
      const salePriceInput = window.prompt(
        "Enter the sale price. You can leave this blank if you only want to use a discount percentage.",
        product.salePrice ?? ""
      );

      if (salePriceInput === null) return;

      const salePrice =
        salePriceInput.trim() === ""
          ? ""
          : Number(salePriceInput);

      if (
        salePrice !== "" &&
        (!Number.isFinite(salePrice) || salePrice < 0)
      ) {
        alert("Please enter a valid sale price.");
        return;
      }

      updates.salePrice = salePrice;
    }

    if (nextStatus === "hidden") {
      const hiddenUntilInput = window.prompt(
        "Hide this product until (YYYY-MM-DD):",
        product.hiddenUntil
          ? String(product.hiddenUntil).slice(0, 10)
          : ""
      );

      if (hiddenUntilInput === null) return;

      const parsedDate = new Date(
        `${hiddenUntilInput}T23:59:59`
      );

      if (
        !hiddenUntilInput ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate <= new Date()
      ) {
        alert("Please enter a future date in YYYY-MM-DD format.");
        return;
      }

      updates.hiddenUntil = parsedDate.toISOString();
    }

    if (nextStatus === "active") {
      updates.hiddenUntil = "";
    }

    try {
      setStatusSavingId(product.id);

      await updateProduct(product.id, { ...product, ...updates });

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? { ...item, ...updates }
            : item
        )
      );
    } catch (error) {
      console.error("Could not update product status:", error);

      const reason =
        error?.code ||
        error?.message ||
        "Unknown Firebase error";

      alert(`Could not update product status: ${reason}`);
    } finally {
      setStatusSavingId(null);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
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
  if(saving||mediaBusy)return;

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

      name: form.name.trim(),

      sellingPrice,

      costPrice,

      category: form.category.trim(),

      stock,

      description:
        form.description.trim(),

      media: form.media,
      imageUrl: primaryImage(form.media),
      status: form.status || "active",
      salePrice: form.salePrice,
      salePercent: form.salePercent,
      hiddenUntil: form.hiddenUntil,

      imageName: form.imageName,

      createdAt:
        existingProduct?.createdAt ||
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),
    };

    setSaving(true);setImageError("");
    try {
  if (editingId) {
    await updateProduct(editingId, productData);

    setProducts((current) =>
      current.map((product) =>
        product.id === editingId
          ? { ...productData, id: editingId }
          : product
      )
    );
  } else {
    await addProduct(productData);

const updatedProducts = await getProducts();
setProducts(updatedProducts);
  }

  resetForm();

} catch (error) {
  console.error("Could not save product:", error);
  setImageError(error.message || "Could not save this product. Please try again.");
} finally { setSaving(false); }
  }

  function handleEdit(product) {
    setEditingId(product.id);
    setImageError("");

    setForm({
      ...emptyForm,
      ...product,
      media: mediaItems(product),
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

  async function handleDelete(productId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this product?"
    );

    if (!confirmed) return;
    try {
      await deleteProduct(productId);
      setProducts(current => current.filter(product => product.id !== productId));
    } catch (error) {
      console.error("Could not delete product:", error);
      alert("Could not delete product.");
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

            <MediaFields items={form.media || []} onChange={media=>setForm(current=>({...current,media,imageUrl:primaryImage(media)}))} onBusyChange={setMediaBusy} disabled={saving}/>
            {imageError && <p className="product-image-error" role="alert">{imageError}</p>}
            <div className="product-form-grid">
              <div className="product-field">
                <label htmlFor="status">
                  Product status
                </label>

                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="onSale">
                    On Sale
                  </option>

                  <option value="hidden">
                    Hidden
                  </option>
                </select>
              </div>


            </div>

            {form.status === "onSale" && (
              <>
                <div className="product-field">
                  <label htmlFor="salePrice">
                    Sale price
                  </label>

                  <div className="product-money-field">
                    <span>$</span>

                    <input
                      id="salePrice"
                      name="salePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.salePrice}
                      onChange={handleChange}
                      placeholder="Enter any sale price"
                    />
                  </div>

                  <small>
                    Optional. Enter any sale price you want.
                  </small>
                </div>

                <div className="product-field">
                  <label>
                    Discount percentage
                  </label>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      marginTop: "8px",
                    }}
                  >
                    {[10, 20, 30, 40, 50, 60, 70].map(
                      (percent) => (
                        <button
                          key={percent}
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              salePercent: String(percent),
                            }))
                          }
                        >
                          {percent}%
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          salePercent: "other",
                        }))
                      }
                    >
                      Other
                    </button>
                  </div>

                  {form.salePercent === "other" && (
                    <input
                      name="salePercent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value=""
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          salePercent:
                            event.target.value,
                        }))
                      }
                      placeholder="Enter your percentage"
                      style={{ marginTop: "10px" }}
                    />
                  )}

                  {form.salePercent !== "" &&
                    form.salePercent !== "other" && (
                      <small
                        style={{
                          display: "block",
                          marginTop: "8px",
                        }}
                      >
                        Selected: {form.salePercent}%
                      </small>
                    )}

                  <small
                    style={{
                      display: "block",
                      marginTop: "8px",
                    }}
                  >
                    Optional. You do not have to choose a percentage.
                  </small>
                </div>
              </>
            )}

            {form.status === "hidden" && (
              <div className="product-field">
                <label htmlFor="hiddenUntil">
                  Show product again on
                </label>

                <input
                  id="hiddenUntil"
                  name="hiddenUntil"
                  type="date"
                  value={form.hiddenUntil}
                  onChange={handleChange}
                  min={new Date()
                    .toISOString()
                    .slice(0, 10)}
                />
              </div>
            )}

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
                type="submit" disabled={saving || mediaBusy}
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
                                handleEdit(product)
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className={
                                normalizeStatus(product) === "active"
                                  ? "active"
                                  : ""
                              }
                              disabled={
                                statusSavingId === product.id
                              }
                              onClick={() =>
                                handleStatusChange(
                                  product,
                                  "active"
                                )
                              }
                            >
                              Active
                            </button>

                            <button
                              type="button"
                              className={
                                normalizeStatus(product) === "onSale"
                                  ? "active"
                                  : ""
                              }
                              disabled={
                                statusSavingId === product.id
                              }
                              onClick={() =>
                                handleStatusChange(
                                  product,
                                  "onSale"
                                )
                              }
                            >
                              On Sale
                            </button>

                            <button
                              type="button"
                              className={
                                normalizeStatus(product) === "hidden"
                                  ? "active"
                                  : ""
                              }
                              disabled={
                                statusSavingId === product.id
                              }
                              onClick={() =>
                                handleStatusChange(
                                  product,
                                  "hidden"
                                )
                              }
                            >
                              Hidden
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
