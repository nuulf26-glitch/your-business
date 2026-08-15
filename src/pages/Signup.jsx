import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { saveUserProfile } from "../services/userService";
import "../styles/auth.css";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
function Signup() {
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      const userCredential = await createUserWithEmailAndPassword(
  auth,
  email.trim(),
  password
);
try {

await saveUserProfile(userCredential.user.uid, {
  email: email.trim(),
  fullName: fullName.trim(),
  businessName: businessName.trim(),
  marketingConsent: true,
});
} catch (error) {
  console.error("PROFILE SAVE ERROR:", error.code, error.message);
}

await sendEmailVerification(userCredential.user);
navigate("/create-website");
    } catch (signupError) {
console.error("SIGNUP ERROR:", signupError.code, signupError.message);      if (signupError.code === "auth/email-already-in-use") {
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
          Your Business
        </Link>

        <div className="auth-brand-content">
          <span className="auth-eyebrow">Build without coding</span>

          <h1>
            Turn your business idea
            <br />
            into a real website.
          </h1>

          <p>
            Create your store, customize your design, add products, and start
            accepting orders from one simple platform.
          </p>

          <div className="auth-benefits">
            <div>
              <span>01</span>
              <p>14-day free trial</p>
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
            <Link to="/">Your Business</Link>
          </div>

          <div className="auth-heading">
            <span className="auth-eyebrow">Create your account</span>

            <h2>Start building your website</h2>

            <p>
              Enter your details below. You can customize everything after
              creating your account.
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
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
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
              <input type="checkbox" required />

              <span>
                I agree to the{" "}
                <Link to="/terms">Terms of Service</Link> and{" "}
                <Link to="/privacy">Privacy Policy</Link>.
              </span>
            </label>

            {error && <p className="auth-error">{error}</p>}

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