import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import "../styles/auth.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      await signInWithEmailAndPassword(auth, email.trim(), password);

      navigate("/dashboard");
    } catch (loginError) {
      console.error(loginError);

      if (
        loginError.code === "auth/invalid-credential" ||
        loginError.code === "auth/wrong-password" ||
        loginError.code === "auth/user-not-found"
      ) {
        setError("The email or password is incorrect.");
      } else if (loginError.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (loginError.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait and try again.");
      } else {
        setError("We could not log you in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <Link className="auth-brand-logo" to="/">
          Your Business
        </Link>

        <div className="auth-brand-content">
          <span className="auth-eyebrow">Welcome back</span>

          <h1>
            Manage your business
            <br />
            from one place.
          </h1>

          <p>
            Access your website, products, orders, customers, and analytics
            from your business dashboard.
          </p>

          <div className="auth-benefits">
            <div>
              <span>01</span>
              <p>Manage your website</p>
            </div>

            <div>
              <span>02</span>
              <p>Track orders and customers</p>
            </div>

            <div>
              <span>03</span>
              <p>View business analytics</p>
            </div>
          </div>
        </div>

        <p className="auth-brand-footer">
          Everything your business needs, in one dashboard.
        </p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrapper">
          <div className="auth-mobile-header">
            <Link to="/">Your Business</Link>
          </div>

          <div className="auth-heading">
            <span className="auth-eyebrow">Log in</span>

            <h2>Welcome back</h2>

            <p>
              Enter your account details to continue managing your business.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-field">
              <label htmlFor="loginEmail">Email address</label>

              <input
                id="loginEmail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="loginPassword">Password</label>

                <Link to="/forgot-password">Forgot password?</Link>
              </div>

              <div className="auth-password-field">
                <input
                  id="loginPassword"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button
              type="submit"
              className="auth-submit-button"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="auth-switch-text">
            Don’t have an account? <Link to="/signup">Create one</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

export default Login;