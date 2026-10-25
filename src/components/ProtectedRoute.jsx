import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { customBackendRequest, establishCustomBackendSession, isCustomBackendSessionEnabled } from "../services/customBackendSession";

function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    if (isCustomBackendSessionEnabled()) {
      let active = true;
      const checkCustomSession = () => customBackendRequest('/auth/me')
        .then((account) => { if (active) { setUser(account); setCheckingUser(false); } })
        .catch(() => { if (active) { setUser(null); setCheckingUser(false); } });
      const stopListening = onAuthStateChanged(auth, async (currentUser) => {
        if (!currentUser) { await checkCustomSession(); return; }
        try {
          await establishCustomBackendSession(currentUser);
          await checkCustomSession();
        } catch {
          if (active) { setUser(null); setCheckingUser(false); }
        }
      });
      return () => { active = false; stopListening(); };
    }
const stopListening = onAuthStateChanged(auth, (currentUser) => {

        setUser(currentUser);
      setCheckingUser(false);
    });

    return () => stopListening();
  }, []);

  if (checkingUser) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
