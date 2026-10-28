import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { subscribeAppUser } from "../services/customBackendSession";
import AiHelpWidget from "./AiHelpWidget";

function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeAppUser((currentUser) => { setUser(currentUser); setCheckingUser(false); });
    return unsubscribe;
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

  return <>{children}<AiHelpWidget /></>;
}

export default ProtectedRoute;
