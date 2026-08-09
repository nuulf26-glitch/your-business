import { Link, useNavigate } from "react-router-dom";
import "./landing.css";

const productLinks = [
  { label: "Website Builder", href: "#website-builder" },
  { label: "Analytics", href: "#analytics" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const companyLinks = [
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms of Service", to: "/terms" },
];

function Footer() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  function scrollToSection(sectionId) {
    const section = document.querySelector(sectionId);

    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="footer-top">
          <div className="footer-brand">
            <button
              type="button"
              className="footer-logo"
              onClick={() => navigate("/")}
            >
              Your Business
            </button>

            <p>
              Create, publish, and manage your professional business website
              without coding.
            </p>

            <button
              type="button"
              className="footer-primary-button"
              onClick={() => navigate("/signup")}
            >
              Create your website
            </button>
          </div>

          <div className="footer-links-grid">
            <div className="footer-link-column">
              <h3>Product</h3>

              {productLinks.map((link) => (
                <button
                  type="button"
                  key={link.label}
                  onClick={() => scrollToSection(link.href)}
                >
                  {link.label}
                </button>
              ))}
            </div>

            <div className="footer-link-column">
              <h3>Company</h3>

              {companyLinks.map((link) => (
                <Link key={link.label} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="footer-link-column">
              <h3>Account</h3>

              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
              <Link to="/dashboard">Dashboard</Link>
            </div>
          </div>
        </div>

        <div className="footer-middle">
          <div>
            <span>Built for modern businesses</span>
            <p>
              Start with a 14-day free trial and build your store at your own
              pace.
            </p>
          </div>

          <button
            type="button"
            className="footer-secondary-button"
            onClick={() => navigate("/signup")}
          >
            Start free
          </button>
        </div>

        <div className="footer-bottom">
          <p>© {currentYear} Your Business. All rights reserved.</p>

          <div>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/contact">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;