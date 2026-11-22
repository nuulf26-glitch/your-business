import { Link } from 'react-router-dom';
import '../styles/companyPages.css';

const SUPPORT_EMAIL = 'createyourbusiness6@gmail.com';

export default function Contact() {
  const subject = encodeURIComponent('CYB support request');
  return <main className="company-page">
    <header className="company-nav"><Link to="/">CYB</Link><nav><Link to="/about">About</Link><Link to="/contact" aria-current="page">Contact</Link><Link to="/pricing">Pricing</Link><Link to="/login">Log in</Link></nav></header>
    <section className="contact-hero"><p>CONTACT</p><h1>How can we help?</h1><p>For account, product, or privacy questions, email the CYB team. Include the email on your account and a short description so we can direct your request.</p><a className="company-cta" href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}>Email CYB support ↗</a><a className="contact-address" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></section>
    <footer className="company-footer"><span>CYB</span><div><Link to="/about">About</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div></footer>
  </main>;
}
