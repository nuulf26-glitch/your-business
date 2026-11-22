import { Link } from 'react-router-dom';
import '../styles/companyPages.css';

export default function About() {
  return <main className="company-page">
    <header className="company-nav"><Link to="/">CYB</Link><nav><Link to="/about" aria-current="page">About</Link><Link to="/contact">Contact</Link><Link to="/pricing">Pricing</Link><Link to="/login">Log in</Link></nav></header>
    <section className="company-hero"><p>ABOUT CYB</p><h1>Make your business<br/>ready for the web.</h1><div><p>CYB brings the essential tools to create and manage a business website in one place: an AI website builder, an editor, a storefront, customer management, analytics, bookings, and publishing.</p><Link className="company-cta" to="/signup">Create your account ↗</Link></div></section>
    <section className="company-grid"><article><span>01</span><h2>Build with confidence</h2><p>Start from a template or describe your business to generate a first draft, then shape the site in the editor.</p></article><article><span>02</span><h2>Run the essentials</h2><p>Manage products, orders, customers, content, appointments, and the business activity your site collects.</p></article><article><span>03</span><h2>Publish when ready</h2><p>Review your draft and publish the website when it reflects your business.</p></article></section>
    <footer className="company-footer"><span>CYB</span><div><Link to="/contact">Contact</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div></footer>
  </main>;
}
