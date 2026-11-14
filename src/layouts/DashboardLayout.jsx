import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../services/authService";
import { subscribeAppUser } from "../services/customBackendSession";
import { getStore } from "../services/storeService";
import "../styles/workspace-layout.css";

function DashboardLayout({ children }) {
  const navigate = useNavigate();

  const [storeUrl, setStoreUrl] = useState("");
  const [loadingStore, setLoadingStore] = useState(true);

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

          const storeData = await getStore();
          setStoreUrl(storeData?.storeUrl || "");
        } catch (error) {
          console.error(
            "Error loading store URL:",
            error
          );

          setStoreUrl("");
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
    { label: "Overview", path: "/dashboard" },
    { label: "Website editor", path: "/editor" },
    { label: "Templates", path: "/templates" },
    { label: "Products", path: "/products" },
    { label: "Orders", path: "/orders" },
    { label: "Customers", path: "/customers" },
    { label: "Business tools", path: "/business" },
    { label: "Shipping", path: "/shipping" },
    { label: "Settings", path: "/settings" },
  ];

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <NavLink className="workspace-logo" to="/dashboard" aria-label="CYB dashboard">CYB<span>BUSINESS STUDIO</span></NavLink>

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
