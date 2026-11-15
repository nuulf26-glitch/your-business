import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/templates.css";

const categories = [
  { id: "all", label: "All designs" },
  { id: "modern", label: "Modern" },
  { id: "dark", label: "Luxury dark" },
];
const templates = [
  { id: "modern", title: "Modern Style", category: "modern", badge: "Modern business", description: "A clean, bright foundation for brands, stores and professional services.", features: ["Products", "Gallery", "Contact"], previewBg: "#f3eee5" },
  { id: "dark", title: "Luxury Dark", category: "dark", badge: "Luxury brand", description: "A charcoal and warm beige direction for fashion and premium brands.", features: ["Shop", "Collections", "Brand page"], previewBg: "#25231f" },
];

function TemplateCard({ template, favorite, onFavorite, onPreview, onUse }) {
  return <article className={`template-card template-card--${template.id}`}>
    <div className="template-preview" style={{ "--template-preview-bg": template.previewBg }}>
      <div className="template-browser"><span /><span /><span /><small>CYB DESIGN PREVIEW</small></div>
      <div className="template-site-preview">
        <header><strong>{template.title}</strong><nav><span>Home</span><span>Shop</span><span>About</span></nav><i /></header>
        <div className="template-site-hero"><small>{template.badge}</small><strong>{template.id === "modern" ? "Make your next idea feel at home." : "A world of quiet refinement."}</strong><span>Introductory text can be customized in the editor.</span><button type="button" tabIndex={-1} aria-hidden="true">Explore</button></div>
        <div className="template-preview-blocks"><i /><i /><i /></div>
      </div>
      <button className={`template-favorite${favorite ? " active" : ""}`} type="button" aria-label={favorite ? `Remove ${template.title} from favorites` : `Add ${template.title} to favorites`} aria-pressed={favorite} onClick={onFavorite}>{favorite ? "♥" : "♡"}</button>
    </div>
    <div className="template-card-content"><div className="template-card-title"><div><span>{template.badge}</span><h2>{template.title}</h2></div><span className="template-current-state">Template</span></div><p>{template.description}</p><div className="template-feature-list">{template.features.map(feature => <span key={feature}>{feature}</span>)}</div><div className="template-card-actions"><button type="button" className="template-secondary" onClick={onPreview}>Preview design</button><button type="button" className="template-primary" onClick={onUse}>Use template <span aria-hidden="true">↗</span></button></div></div>
  </article>;
}

export default function Templates() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState([]);
  const filteredTemplates = useMemo(() => templates.filter(template => {
    const categoryMatch = selectedCategory === "all" || template.category === selectedCategory;
    const query = searchQuery.trim().toLowerCase();
    const textMatch = !query || `${template.title} ${template.badge} ${template.description}`.toLowerCase().includes(query);
    return categoryMatch && textMatch;
  }), [selectedCategory, searchQuery]);
  function toggleFavorite(id) { setFavorites(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  function chooseTemplate(id) { localStorage.setItem("selectedTemplate", id); navigate("/editor"); }

  return <main className="templates-page">
    <header className="templates-header"><div><span className="templates-kicker">CYB / DESIGN LIBRARY</span><h1>Choose your starting point.</h1><p>Explore the templates currently available, then customize your pages in the editor.</p></div><button type="button" className="templates-back-button" onClick={() => navigate("/dashboard")}>← Dashboard</button></header>
    <section className="templates-toolbar" aria-label="Filter templates"><div className="template-category-tabs" role="group" aria-label="Template categories">{categories.map(category => <button type="button" key={category.id} className={selectedCategory === category.id ? "active" : ""} aria-pressed={selectedCategory === category.id} onClick={() => setSelectedCategory(category.id)}>{category.label}</button>)}</div><label className="template-search"><span className="sr-only">Search templates</span><span aria-hidden="true">⌕</span><input type="search" placeholder="Search designs" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} /></label></section>
    <div className="templates-result-meta"><span>{filteredTemplates.length} {filteredTemplates.length === 1 ? "design" : "designs"} available</span><span>Favorites stay in this browser</span></div>
    {filteredTemplates.length ? <section className="templates-grid" aria-label="Available templates">{filteredTemplates.map(template => <TemplateCard key={template.id} template={template} favorite={favorites.includes(template.id)} onFavorite={() => toggleFavorite(template.id)} onPreview={() => navigate(`/template-preview/${template.id}`)} onUse={() => chooseTemplate(template.id)} />)}</section> : <section className="templates-empty"><span aria-hidden="true">⌕</span><h2>No designs found</h2><p>Try a different search or category.</p><button type="button" onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}>Clear filters</button></section>}
    <p className="templates-scope-note">This gallery reflects the template families available in CYB today.</p>
  </main>;
}
