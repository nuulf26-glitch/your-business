import { Link } from 'react-router-dom';
import Navbar from '../landing/Navbar';
import Pricing from '../landing/Pricing';
import Footer from '../landing/Footer';
import '../landing/landing.css';

export default function PricingPage() {
  return <div className="landing-page"><Navbar /><main><Pricing /></main><Footer /><p className="pricing-back"><Link to="/">Back to CYB home</Link></p></div>;
}
