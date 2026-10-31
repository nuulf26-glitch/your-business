import { useState } from "react";
import { Link } from "react-router-dom";
import { customBackendRequest } from "../services/customBackendSession";
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

      await customBackendRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });

      setMessage("If an account matches that email, we’ll send a password reset link. Check your inbox shortly.");
    } catch (resetError) {
      setError(resetError.status === 429 ? "Too many requests. Please wait a minute and try again." : "We could not process your request. Please check the email format and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-form-panel">
        <div className="auth-form-wrapper">

          <Link className="auth-brand-logo" to="/">
            CYB
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
