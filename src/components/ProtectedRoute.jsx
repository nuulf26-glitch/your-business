import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { subscribeAppUser } from "../services/customBackendSession";
import AiHelpWidget from "./AiHelpWidget";

function ProtectedRoute({ children }) {
  const { pathname } = useLocation();
  const [user, setUser] = useState(null);
  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeAppUser((currentUser) => {
      if (currentUser === undefined) {
        setUser(null);
        setCheckingUser(true);
        return;
      }
      setUser(currentUser);
      setCheckingUser(false);
    });
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

  return <><div key={user.id}>{children}</div>{pathname.startsWith("/editor") ? null : <AiHelpWidget key={user.id} />}</>;
}

export default ProtectedRoute;
