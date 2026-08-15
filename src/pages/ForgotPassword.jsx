import { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import "../styles/auth.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);

      await sendPasswordResetEmail(auth, email.trim());

      setMessage("Password reset email sent. Check your inbox.");
    } catch (resetError) {
      console.error(resetError);

      if (resetError.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else if (resetError.code === "auth/invalid-email") {
        setError("Please enter a valid email.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-form-panel">
        <div className="auth-form-wrapper">

          <Link className="auth-brand-logo" to="/">
            Your Business
          </Link>

          <div className="auth-heading">
            <span className="auth-eyebrow">Reset password</span>

            <h2>Forgot your password?</h2>

            <p>
              Enter your email and we will send you a password reset link.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleReset}>
            <div className="auth-field">
              <label>Email address</label>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </div>

            {message && <p className="auth-success">{message}</p>}
            {error && <p className="auth-error">{error}</p>}

            <button
              className="auth-submit-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>

          <p className="auth-switch-text">
            Remember your password? <Link to="/login">Log in</Link>
          </p>

        </div>
      </section>
    </div>
  );
}

export default ForgotPassword;