import { useNavigate } from "react-router-dom";
import "../styles/legal.css";

function Terms() {
  const navigate = useNavigate();

  return (
    <div className="legal-page">
      <header className="legal-header">
        <button
          type="button"
          className="legal-logo"
          onClick={() => navigate("/")}
        >
          Your Business
        </button>

        <button
          type="button"
          className="legal-back-button"
          onClick={() => navigate(-1)}
        >
          Go back
        </button>
      </header>

      <main className="legal-main">
        <section className="legal-hero">
          <span>Legal</span>
          <h1>Terms and Conditions</h1>
          <p>Last updated: July 2026</p>
        </section>

        <section className="legal-content">
          <article>
            <h2>1. Agreement to these terms</h2>
            <p>
              By accessing or using Your Business, you agree to these Terms
              and Conditions. If you do not agree, you must not use the
              platform.
            </p>
          </article>

          <article>
            <h2>2. Platform purpose</h2>
            <p>
              Your Business provides tools that allow business owners to
              create websites, display products, manage orders, communicate
              with customers, and operate parts of their online business.
            </p>
          </article>

          <article>
            <h2>3. Accounts</h2>
            <p>
              You are responsible for providing accurate account information,
              keeping your login details secure, and all activity that happens
              through your account.
            </p>
          </article>

          <article>
            <h2>4. Business owner responsibilities</h2>
            <p>
              Business owners are responsible for their products, prices,
              descriptions, customer service, deliveries, refunds, taxes,
              licences, and compliance with applicable laws.
            </p>
          </article>

          <article>
            <h2>5. Prohibited products and activities</h2>
            <p>
              Users must not use the platform to sell illegal, counterfeit,
              dangerous, misleading, stolen, or prohibited products or to
              engage in fraud, abuse, harassment, or unlawful activity.
            </p>
          </article>

          <article>
            <h2>6. Payments</h2>
            <p>
              Payments may be handled by third-party payment providers. Payment
              availability, processing times, fees, refunds, and disputes may
              also be subject to the provider’s own terms.
            </p>
          </article>

          <article>
            <h2>7. Orders and fulfilment</h2>
            <p>
              Orders placed through a store are agreements between the
              customer and the relevant business owner. The business owner is
              responsible for processing and fulfilling each order.
            </p>
          </article>

          <article>
            <h2>8. Fees and subscriptions</h2>
            <p>
              Certain features may require payment. Prices, billing periods,
              trials, and renewal terms will be shown before purchase. Fees
              may change for future billing periods.
            </p>
          </article>

          <article>
            <h2>9. Content ownership</h2>
            <p>
              Users keep ownership of content they upload, but grant the
              platform permission to host, display, process, and use that
              content as necessary to provide the service.
            </p>
          </article>

          <article>
            <h2>10. Intellectual property</h2>
            <p>
              The platform design, software, branding, and original content
              belong to their respective owners and may not be copied,
              resold, or misused without permission.
            </p>
          </article>

          <article>
            <h2>11. Suspension and termination</h2>
            <p>
              Accounts may be restricted or terminated when these terms are
              violated, payments are overdue, illegal activity is suspected,
              or continued access creates a security or legal risk.
            </p>
          </article>

          <article>
            <h2>12. Service availability</h2>
            <p>
              The platform may occasionally be unavailable because of updates,
              maintenance, technical problems, or events outside our control.
            </p>
          </article>

          <article>
            <h2>13. Limitation of liability</h2>
            <p>
              To the extent permitted by law, the platform is not responsible
              for indirect losses, lost profits, business interruptions, or
              disputes between business owners and customers.
            </p>
          </article>

          <article>
            <h2>14. Changes to these terms</h2>
            <p>
              These terms may be updated from time to time. Continued use of
              the platform after an update means you accept the revised terms.
            </p>
          </article>

          <article>
            <h2>15. Contact</h2>
            <p>
              Questions about these terms may be sent to:
              legal@yourbusiness.example
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}

export default Terms;