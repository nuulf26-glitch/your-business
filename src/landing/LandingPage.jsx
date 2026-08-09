import Navbar from "./Navbar";
import Hero from "./Hero";
import HowItWorks from "./HowItWorks";
import WebsiteBuilder from "./WebsiteBuilder";
import Analytics from "./Analytics";
import Reviews from "./Reviews";
import Pricing from "./Pricing";
import FAQ from "./FAQ";
import Footer from "./Footer";
import "./landing.css";

function LandingPage() {
  return (
    <div className="landing-page">
      <Navbar />

      <main>
        <Hero />
        <HowItWorks />
        <WebsiteBuilder />
        <Analytics />
        <Reviews />
        <Pricing />
        <FAQ />
      </main>

      <Footer />
    </div>
  );
}

export default LandingPage;