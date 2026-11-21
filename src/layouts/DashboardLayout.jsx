import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../services/authService";
import { subscribeAppUser, getActiveBusinessId, setActiveBusinessId } from "../services/customBackendSession";
import { listStores, createStore } from "../services/storeService";
import "../styles/workspace-layout.css";

function DashboardLayout({ children }) {
  const navigate = useNavigate();

  const [storeUrl, setStoreUrl] = useState("");
  const [loadingStore, setLoadingStore] = useState(true);
  const [stores, setStores] = useState([]);
  const [activeBusinessId, setActiveBusinessIdState] = useState(getActiveBusinessId());
  const [createStoreOpen, setCreateStoreOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreSlug, setNewStoreSlug] = useState("");
  const [creatingStore, setCreatingStore] = useState(false);
  const [storeError, setStoreError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeAppUser(
      async (currentUser) => {
        if (!currentUser) {
          setStoreUrl("");
          setLoadingStore(false);
          return;
        }

        try {
          setLoadingStore(true);
          const rows = await listStores();
          setStores(rows);
          const savedId = getActiveBusinessId();
          const selected = rows.find(store => store.id === savedId) || rows[0] || null;
          if (selected && selected.id !== savedId) {
            setActiveBusinessId(selected.id);
            window.location.reload();
            return;
          }
          setActiveBusinessIdState(selected?.id || "");
          setStoreUrl(selected?.storeUrl || "");
        } catch (error) {
          console.error("Error loading stores:", error);
          setStoreUrl("");
          setStores([]);
        } finally {
          setLoadingStore(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  function handleStoreSelection(event) {
    const nextId = event.target.value;
    if (!nextId || nextId === activeBusinessId) return;
    setActiveBusinessId(nextId);
    setActiveBusinessIdState(nextId);
    window.location.reload();
  }

  async function handleCreateStore(event) {
    event.preventDefault();
    setStoreError("");
    setCreatingStore(true);
    try {
      const store = await createStore({ storeName: newStoreName.trim(), businessName: newStoreName.trim(), storeUrl: newStoreSlug.trim().toLowerCase(), businessCategory: "general" });
      setActiveBusinessId(store.id);
      window.location.reload();
    } catch (error) {
      setStoreError(error.message || "Could not create the store.");
    } finally {
      setCreatingStore(false);
    }
  }

  function handleStorePreview() {
    if (loadingStore) {
      return;
    }

    if (!storeUrl) {
      alert(
        "Please configure your store link in settings first."
      );
      return;
    }

    window.open(
      `/store/${storeUrl}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  const navigationItems = [
    { label: "My websites", path: "/dashboard" },
    { label: "Create website", path: "/create-website" },
    { label: "Website editor", path: "/editor" },
    { label: "Templates", path: "/templates" },
    { label: "Store setup", path: "/store-setup" },
    { label: "Store design", path: "/store-designer" },
    { label: "Products", path: "/products" },
    { label: "Orders", path: "/orders" },
    { label: "Customers", path: "/customers" },
    { label: "CRM", path: "/crm" },
    { label: "Analytics & reports", path: "/analytics" },
    { label: "Business tools", path: "/business" },
    { label: "Shipping", path: "/shipping" },
    { label: "Settings", path: "/settings" },
  ];

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <NavLink className="workspace-logo" to="/dashboard" aria-label="CYB dashboard">CYB<span>BUSINESS STUDIO</span></NavLink>

        {stores.length > 0 && <section className="workspace-store-switcher" aria-label="Store management">
          <label htmlFor="active-store">Active store</label>
          <select id="active-store" aria-label="Active store" value={activeBusinessId} onChange={handleStoreSelection} disabled={loadingStore}>
            {stores.map(store => <option key={store.id} value={store.id}>{store.storeName || store.businessName || store.name}</option>)}
          </select>
          <button type="button" className="workspace-add-store" onClick={() => { setCreateStoreOpen(value => !value); setStoreError(""); }}>+ Add store</button>
          {createStoreOpen && <form className="workspace-create-store" onSubmit={handleCreateStore}>
            <label htmlFor="new-store-name">Store name</label>
            <input id="new-store-name" value={newStoreName} onChange={event => { const name = event.target.value; setNewStoreName(name); setNewStoreSlug(name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} maxLength={120} required />
            <label htmlFor="new-store-slug">Store URL</label>
            <input id="new-store-slug" value={newStoreSlug} onChange={event => setNewStoreSlug(event.target.value.toLowerCase())} maxLength={100} pattern="[a-z0-9-]+" required />
            {storeError && <p role="alert">{storeError}</p>}
            <button type="submit" disabled={creatingStore}>{creatingStore ? "Creating…" : "Create store"}</button>
          </form>}
        </section>}
        <button
          type="button"
          onClick={handleStorePreview}
          disabled={loadingStore}
          className="workspace-preview-button"
        >
          {loadingStore
            ? "Loading Store..."
            : "Open Store Preview"}
        </button>

        <nav className="workspace-navigation" aria-label="Workspace">
          {navigationItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => isActive ? "workspace-nav-link active" : "workspace-nav-link"}
            >
              {item.label}
            </NavLink>
          ))}
          <a className="workspace-nav-link" href="/#faq">Help &amp; FAQ</a>
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="workspace-logout-button"
        >
          Logout
        </button>
      </aside>

      <main className="workspace-main">
        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;
