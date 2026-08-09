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
    question: "Is there a free trial?",
    answer:
      "Yes. Every account starts with a 14-day free trial before purchasing.",
  },
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