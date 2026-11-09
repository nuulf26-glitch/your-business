import { useState } from "react";
import "./landing.css";

const faqs = [
  {
    question: "Do I need coding experience?",
    answer:
      "No. Everything can be done using the visual website builder.",
  },
  {
    question: "Can I sell physical products?",
    answer:
      "Yes. You can add unlimited products, manage inventory, receive orders, and track customers.",
  },
  {
    question: "Can I use my own domain?",
    answer:
      "Yes. You can connect your own custom domain whenever you're ready.",
  },
  {
    question: "What can I do before paying?",
    answer: "Create a free account to build and edit a website draft. Publishing is available after CYB Lifetime Access is activated.",
  },
  { question: "Can I build my website before paying?", answer: "Yes. Create a free account and work on your website draft. Activate lifetime access when you are ready to publish." },
  { question: "How much is lifetime access?", answer: "CYB Lifetime Access is a one-time payment of $246 USD. Review the current Terms of Service for the applicable 30-day refund terms." },
  { question: "Can I save my website draft?", answer: "Yes. Your website changes are saved to your account so you can return and continue editing." },
  { question: "When can I publish my website?", answer: "You can publish after activating CYB Lifetime Access with the one-time payment." },
  {
    question: "Can I edit my website later?",
    answer:
      "Absolutely. You can update your website, products, prices, and pages anytime.",
  },
  {
    question: "Does it work on mobile?",
    answer:
      "Yes. Every website is automatically optimized for desktop, tablet, and mobile devices.",
  },
];

function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section className="faq-section" id="faq">
      <div className="landing-container">
        <div className="faq-heading">
          <span className="section-label">FAQ</span>

          <h2>
            Frequently
            <br />
            asked questions
          </h2>

          <p>
            Everything you need to know before creating your business website.
          </p>
        </div>

        <div className="faq-list">
          {faqs.map((item, index) => (
            <div
              className={`faq-item ${open === index ? "active" : ""}`}
              key={item.question}
            >
              <button
                className="faq-question"
                onClick={() =>
                  setOpen(open === index ? -1 : index)
                }
              >
                <span>{item.question}</span>

                <strong>{open === index ? "−" : "+"}</strong>
              </button>

              {open === index && (
                <div className="faq-answer">
                  <p>{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FAQ;
