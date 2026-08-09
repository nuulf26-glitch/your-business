import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { logout } from "../services/authService";
import { auth, db } from "../firebase";

function DashboardLayout({ children }) {
  const navigate = useNavigate();

  const [storeUrl, setStoreUrl] = useState("");
  const [loadingStore, setLoadingStore] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          setStoreUrl("");
          setLoadingStore(false);
          return;
        }

        try {
          setLoadingStore(true);

          const storeQuery = query(
            collection(db, "stores"),
            where("userId", "==", currentUser.uid)
          );

          const storeSnapshot = await getDocs(storeQuery);

          if (!storeSnapshot.empty) {
            const storeData =
              storeSnapshot.docs[0].data();

            setStoreUrl(storeData.storeUrl || "");
          } else {
            setStoreUrl("");
          }
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
    {
      label: "Dashboard",
      path: "/dashboard",
    },
    {
      label: "Products",
      path: "/products",
    },
    {
      label: "Orders",
      path: "/orders",
    },
    {
      label: "Customers",
      path: "/customers",
    },
    {
      label: "Shipping",
      path: "/shipping",
    },
    {
      label: "Settings",
      path: "/settings",
    },
  ];

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <h2 style={styles.logo}>
          Your Business
        </h2>

        <button
          type="button"
          onClick={handleStorePreview}
          disabled={loadingStore}
          style={{
            ...styles.previewButton,
            opacity: loadingStore ? 0.6 : 1,
            cursor: loadingStore
              ? "not-allowed"
              : "pointer",
          }}
        >
          {loadingStore
            ? "Loading Store..."
            : "Open Store Preview"}
        </button>

        <nav style={styles.navigation}>
          {navigationItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                ...styles.link,
                backgroundColor: isActive
                  ? "rgba(255, 255, 255, 0.14)"
                  : "transparent",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          style={styles.logoutButton}
        >
          Logout
        </button>
      </aside>

      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#f7f7fb",
  },

  sidebar: {
    width: "250px",
    minWidth: "250px",
    height: "100vh",
    padding: "30px",
    boxSizing: "border-box",
    backgroundColor: "#111827",
    color: "#ffffff",
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
  },

  logo: {
    margin: 0,
    fontSize: "24px",
  },

  previewButton: {
    width: "100%",
    marginTop: "28px",
    padding: "13px 12px",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "10px",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    fontWeight: "700",
  },

  navigation: {
    marginTop: "22px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  link: {
    padding: "12px 14px",
    borderRadius: "9px",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: "17px",
  },

  logoutButton: {
    width: "100%",
    marginTop: "auto",
    padding: "14px",
    border: "none",
    borderRadius: "12px",
    backgroundColor: "#ef4444",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
  },

  main: {
    flex: 1,
    minWidth: 0,
    padding: "40px",
  },
};

export default DashboardLayout;