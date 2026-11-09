import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/auth.css";
import { register } from "../services/authService";
function Signup() {
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState(() => new URLSearchParams(window.location.search).get("businessName") || "");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

async function handleSignup(event) {   
   event.preventDefault();
    setError("");

    if (!businessName.trim() || !fullName.trim() || !email.trim() || !password) {
      setError("Please complete all fields.");
      return;
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    try {
      setLoading(true);

      await register(email.trim(), password, { fullName: fullName.trim(), businessName: businessName.trim() });
      navigate(new URLSearchParams(window.location.search).get("activate") === "1" ? "/platform-payment" : "/dashboard", { replace: true });
    } catch (signupError) {
      if (signupError.status === 409 || signupError.code === "auth/email-already-in-use") {
        setError("An account already exists with this email.");
      } else if (signupError.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (signupError.code === "auth/weak-password") {
        setError("Please choose a stronger password.");
      } else {
        setError("We could not create your account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <Link className="auth-brand-logo" to="/">
          CYB
        </Link>

        <div className="auth-brand-content">
          <span className="auth-eyebrow">Build without coding</span>

          <h1>
            Turn your business idea
            <br />
            into a real website.
          </h1>

          <p>
            Create your website, customize its design, showcase your services
            or products, and manage customer inquiries or orders in one place.
          </p>

          <div className="auth-benefits">
            <div>
              <span>01</span>
              <p>Website draft before publishing</p>
            </div>

            <div>
              <span>02</span>
              <p>No coding required</p>
            </div>

            <div>
              <span>03</span>
              <p>Mobile-ready website</p>
            </div>
          </div>
        </div>

        <p className="auth-brand-footer">
          Built for modern business owners.
        </p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrapper">
          <div className="auth-mobile-header">
            <Link to="/">CYB</Link>
          </div>

          <div className="auth-heading">
            <span className="auth-eyebrow">Create your account</span>

            <h2>Start building your website</h2>

              <p>
              Enter your details to start building your website. Customize its design
              and products before publishing. CYB Lifetime Access is a one-time
              $246 payment.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSignup}>
            <div className="auth-field">
              <label htmlFor="businessName">Business name</label>

              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Your business name"
                autoComplete="organization"
                required
                maxLength={120}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="fullName">Full name</label>

              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                required
                maxLength={120}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="signupEmail">Email address</label>

              <input
                id="signupEmail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="signupPassword">Password</label>

              <div className="auth-password-field">
                <input
                  id="signupPassword"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 12 characters"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={200}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <label className="auth-checkbox">
              <input type="checkbox" required checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />

              <span>
                I agree to the{" "}
                <Link to="/terms">Terms of Service</Link> and{" "}
                <Link to="/privacy">Privacy Policy</Link>.
              </span>
            </label>

            {error && <p className="auth-error">{error}</p>}

            <p className="auth-provider-unavailable">Google sign-in is not enabled on this version.</p>

            <button
              type="submit"
              className="auth-submit-button"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="auth-switch-text">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

export default Signup;
