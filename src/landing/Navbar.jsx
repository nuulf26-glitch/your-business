import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./landing.css";

const navigationLinks = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Builder", href: "#website-builder" },
  { label: "Analytics", href: "#analytics" },
  { label: "Reviews", href: "#reviews" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 20);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function scrollToSection(sectionId) {
    setMenuOpen(false);

    if (location.pathname !== "/") {
      navigate("/");

      setTimeout(() => {
        const section = document.querySelector(sectionId);

        if (section) {
          section.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 150);

      return;
    }

    const section = document.querySelector(sectionId);

    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  function goHome() {
    setMenuOpen(false);

    if (location.pathname === "/") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    navigate("/");
  }

  return (
    <header
      className={`landing-navbar ${
        scrolled ? "landing-navbar-scrolled" : ""
      }`}
    >
      <div className="landing-container navbar-inner">
        <button
          type="button"
          className="navbar-logo"
          onClick={goHome}
          aria-label="Go to homepage"
        >
          Your Business
        </button>

        <nav
          className={`navbar-links ${
            menuOpen ? "navbar-links-open" : ""
          }`}
        >
          {navigationLinks.map((link) => (
            <button
              type="button"
              key={link.label}
              onClick={() => scrollToSection(link.href)}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="navbar-actions">
          <Link className="navbar-login-link" to="/login">
            Log in
          </Link>

          <button
            type="button"
            className="navbar-signup-button"
            onClick={() => navigate("/signup")}
          >
            Start free
          </button>

          <button
            type="button"
            className={`navbar-menu-button ${
              menuOpen ? "navbar-menu-button-open" : ""
            }`}
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
          >
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;