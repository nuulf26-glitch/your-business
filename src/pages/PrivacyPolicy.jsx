import { useNavigate } from "react-router-dom";
import "../styles/legal.css";

function PrivacyPolicy() {
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
          <h1>Privacy Policy</h1>
          <p>Last updated: July 2026</p>
        </section>

        <section className="legal-content">
          <article>
            <h2>1. Information we collect</h2>
            <p>
              We may collect information you provide when creating an
              account, building a website, placing an order, or contacting
              support. This may include your name, email address, phone
              number, business information, delivery details, and order
              information.
            </p>
          </article>

          <article>
            <h2>2. How we use your information</h2>
            <p>
              We use information to provide and improve the platform,
              process orders, manage accounts, provide customer support,
              prevent misuse, and communicate important service updates.
            </p>
          </article>

          <article>
            <h2>3. Payments</h2>
            <p>
              Payments may be processed by third-party payment providers.
              We do not store complete card information on our own servers.
              Payment providers may process information according to their
              own privacy policies.
            </p>
          </article>

          <article>
            <h2>4. Business owners and customers</h2>
            <p>
              Business owners using the platform may receive customer
              information needed to fulfil orders, arrange delivery, provide
              support, and manage their business.
            </p>
          </article>

          <article>
            <h2>5. Data storage</h2>
            <p>
              Information may be stored using cloud services and other
              service providers that help operate the platform. Reasonable
              technical and organisational measures are used to protect
              stored information.
            </p>
          </article>

          <article>
            <h2>6. Cookies and local storage</h2>
            <p>
              The platform may use cookies, browser storage, and similar
              technologies to keep users signed in, save settings, maintain
              shopping carts, and improve the experience.
            </p>
          </article>

          <article>
            <h2>7. Sharing information</h2>
            <p>
              Information may be shared with service providers when needed
              to operate the platform, process payments, deliver orders,
              prevent fraud, comply with law, or protect users.
            </p>
          </article>

          <article>
            <h2>8. Your choices</h2>
            <p>
              You may request access to, correction of, or deletion of
              certain personal information, subject to legal and operational
              requirements.
            </p>
          </article>

          <article>
            <h2>9. Children’s privacy</h2>
            <p>
              The platform is not intended for children who are below the
              minimum age required to enter contracts or use online services
              in their location without appropriate permission.
            </p>
          </article>

          <article>
            <h2>10. Changes to this policy</h2>
            <p>
              This policy may be updated from time to time. The updated date
              will appear at the top of this page.
            </p>
          </article>

          <article>
            <h2>11. Contact</h2>
            <p>
              Questions about privacy may be sent to:
              privacy@yourbusiness.example
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}

export default PrivacyPolicy;