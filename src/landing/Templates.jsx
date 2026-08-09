import { useState } from "react";
import "./landing.css";

const templates = [
  {
    name: "Noir Atelier",
    category: "Luxury Fashion",
    description:
      "A bold editorial layout for premium fashion brands and boutiques.",
    image: "/images/template-fashion.jpg",
  },
  {
    name: "Bloom Studio",
    category: "Beauty",
    description:
      "A soft, elegant storefront designed for skincare and beauty businesses.",
    image: "/images/template-beauty.jpg",
  },
  {
    name: "Maison Living",
    category: "Home & Furniture",
    description:
      "A warm minimal template for interiors, furniture, and lifestyle stores.",
    image: "/images/template-home.jpg",
  },
  {
    name: "North Coffee",
    category: "Coffee Shop",
    description:
      "A modern storefront for cafés, bakeries, and specialty food brands.",
    image: "/images/template-coffee.jpg",
  },
  {
    name: "Luna Jewelry",
    category: "Jewelry",
    description:
      "A refined, image-led design made for jewelry and accessories.",
    image: "/images/template-jewelry.jpg",
  },
  {
    name: "Form Studio",
    category: "Minimal Store",
    description:
      "A clean and flexible template for modern product-focused brands.",
    image: "/images/template-minimal.jpg",
  },
];

function Templates() {
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);

  return (
    <section className="templates-section">
      <div className="templates-container">
        <div className="templates-heading">
          <div>
            <p className="section-eyebrow">
              PROFESSIONAL TEMPLATES
            </p>

            <h2>
              Start with a design
              <span> that already looks exceptional.</span>
            </h2>
          </div>

          <p>
            Choose a professionally designed template, then replace the
            text, upload your own images, choose your colors, and make it
            completely yours.
          </p>
        </div>

        <div className="templates-showcase">
          <div className="templates-preview">
            <img
              src={selectedTemplate.image}
              alt={`${selectedTemplate.name} template`}
            />

            <div className="templates-preview-overlay" />

            <div className="templates-preview-content">
              <p>{selectedTemplate.category}</p>
              <h3>{selectedTemplate.name}</h3>
              <span>{selectedTemplate.description}</span>

              <button type="button">
                Preview Template
                <strong>↗</strong>
              </button>
            </div>
          </div>

          <div className="templates-list">
            {templates.map((template, index) => {
              const isSelected =
                selectedTemplate.name === template.name;

              return (
                <button
                  type="button"
                  key={template.name}
                  className={
                    isSelected
                      ? "template-list-item active"
                      : "template-list-item"
                  }
                  onClick={() => setSelectedTemplate(template)}
                >
                  <span className="template-list-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div>
                    <strong>{template.name}</strong>
                    <span>{template.category}</span>
                  </div>

                  <span className="template-list-arrow">
                    →
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="templates-grid">
          {templates.map((template) => (
            <article
              className="template-card"
              key={template.name}
            >
              <div className="template-card-image">
                <img
                  src={template.image}
                  alt={`${template.name} website template`}
                />

                <button
                  type="button"
                  onClick={() => setSelectedTemplate(template)}
                >
                  View Template
                </button>
              </div>

              <div className="template-card-copy">
                <div>
                  <p>{template.category}</p>
                  <h3>{template.name}</h3>
                </div>

                <span>↗</span>
              </div>
            </article>
          ))}
        </div>

        <div className="templates-bottom">
          <p>
            Every template is mobile-ready and can be customized
            without coding.
          </p>

          <button type="button">
            Explore All Templates
            <span>→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

export default Templates;