import { useEffect, useMemo, useRef, useState } from "react";
import { getStore, saveStore } from "../services/storeService";
import { getProducts } from "../services/productService";
import { uploadProductImage } from "../services/imageService";
import "../styles/websiteEditor.css";
import { auth } from "../firebase";
import { WEBSITE_GOALS, getWebsiteGoal } from "../data/websiteGoals";
import BookingFields, { validateBookingSections } from "../components/BookingFields";

const FONTS = [
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "Poppins",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Lato",
];

const DEFAULT_RECENT_COLORS = ["#0b0b0c", "#18243a", "#ead7bb", "#f7f2eb", "#ffffff"];

const SECTION_LIBRARY = [
  { type: "hero", label: "Hero", description: "Your first impression" },
  { type: "about", label: "About", description: "Tell your story" },
  { type: "services", label: "Services", description: "Show what you offer" },
  { type: "menu", label: "Menu", description: "Restaurant items & prices" },
  { type: "booking", label: "Booking", description: "Appointments & classes" },
  { type: "gallery", label: "Gallery", description: "Show your work" },
  { type: "faq", label: "FAQ", description: "Answer common questions" },
  { type: "footer", label: "Footer", description: "Finish your website" },
];

const ELEMENT_LIBRARY = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "button", label: "Button" },
  { type: "photo", label: "Photo" },
  { type: "product", label: "Product" },
  { type: "chat", label: "Chat" },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix = "section") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

function money(value) {
  const number = Number(value);
  return `$${Number.isFinite(number) ? number.toFixed(2) : "0.00"}`;
}

function cleanColor(value, fallback = "#18243a") {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
}

function createSection(type, product = null) {
  const common = {
    id: createId(type),
    type,
    style: { fontFamily: "Georgia", fontSize: 42, color: "#18243a" },
  };

  const sections = {
    hero: {
      ...common, label: "Hero", title: "Make your business unforgettable.",
      body: "Build a website that feels like your brand — clear, beautiful, and ready for customers.",
      buttonText: "Get started", image: "", style: { ...common.style, fontSize: 62, color: "#18243a" },
    },
    about: {
      ...common, label: "About", title: "The story behind your business.",
      body: "Write a short, honest introduction so customers understand what makes you different.",
      buttonText: "Learn more", image: "", style: { ...common.style, fontSize: 37, color: "#171513" },
    },
    services: {
      ...common, label: "Services", title: "What we do", body: "Add your most important services here.",
      items: ["Personal service", "Thoughtful details", "Made for you"], style: { ...common.style, fontSize: 34, color: "#171513" },
    },
    menu: {
      ...common, label: "Menu", title: "Our menu", body: "A simple menu customers can understand at a glance.",
      items: [{ name: "Signature item", price: "$18" }, { name: "House favourite", price: "$24" }, { name: "Something sweet", price: "$12" }],
      style: { ...common.style, fontSize: 34, color: "#171513" },
    },
    booking: {
      ...common, label: "Booking", title: "Book your time", body: "Let customers request an appointment, treatment, class, or consultation.",
      buttonText: "Book now", booking: { timezone: "Asia/Dubai", openDays: [1, 2, 3, 4, 5, 6], openTime: "09:00", closeTime: "18:00", interval: 30, services: [] }, style: { ...common.style, fontSize: 34, color: "#ffffff" },
    },
    gallery: {
      ...common, label: "Gallery", title: "A closer look", body: "Use this space for your work, products, place, or portfolio.",
      images: ["", "", ""], style: { ...common.style, fontSize: 34, color: "#171513" },
    },
    faq: {
      ...common, label: "FAQ", title: "Questions, answered.", body: "Give customers the confidence to take the next step.",
      items: [
        { question: "How do I book?", answer: "Choose the service you want, then send us your preferred time." },
        { question: "Where are you based?", answer: "Add your location and contact details here." },
      ], style: { ...common.style, fontSize: 34, color: "#171513" },
    },
    footer: {
      ...common, label: "Footer", title: "Made with care.", body: "Add your contact details, opening hours, or social links here.",
      style: { ...common.style, fontSize: 28, color: "#ffffff" },
    },
    heading: {
      ...common, label: "Heading", title: "A new heading", body: "", style: { ...common.style, fontSize: 42, color: "#171513" },
    },
    text: {
      ...common, label: "Text", title: "", body: "Write something meaningful about your business.",
      style: { ...common.style, fontFamily: "Arial", fontSize: 18, color: "#4e4944" },
    },
    button: {
      ...common, label: "Button", title: "Take the next step", body: "", buttonText: "Explore now",
      style: { ...common.style, fontFamily: "Arial", fontSize: 15, color: "#18243a" },
    },
    photo: {
      ...common, label: "Photo", title: "Your photo", body: "Upload a photo to bring this section to life.", image: "",
      style: { ...common.style, fontSize: 26, color: "#171513" },
    },
    product: {
      ...common, label: "Product", title: product?.name || "Your product",
      body: product?.description || "Choose a product from your Products page.", image: product?.imageUrl || product?.image || "",
      productId: product?.id || "", price: product?.sellingPrice ?? "", style: { ...common.style, fontSize: 26, color: "#171513" },
    },
    chat: {
      ...common, label: "Chat", title: "Need help?", body: "Message us and we will get back to you.", email: "",
      style: { ...common.style, fontFamily: "Arial", fontSize: 16, color: "#ffffff" },
    },
  };

  return sections[type] || sections.text;
}

function createDefaultModel(setup = {}) {
  const goal = getWebsiteGoal(setup.businessGoal);
  const sections = goal.sections.map((type) => createSection(type));
  sections[0] = { ...sections[0], title: goal.headline, buttonText: goal.action, ...(setup.description ? { body: setup.description } : {}) };
  return {
    editorVersion: 2,
    brandName: setup.businessName || "Your Business",
    businessGoal: goal.id,
    contactEmail: setup.supportEmail || "",
    primaryColor: "#18243a",
    backgroundColor: "#f7f2eb",
    textColor: "#171513",
    recentColors: DEFAULT_RECENT_COLORS,
    sections,
  };
}

function migrateLegacyEditor(raw) {
  const data = raw?.editorData || raw || {};
  const savedSections = data.sections || (data.editorVersion === 2 ? data.elements : null);

  if (Array.isArray(savedSections)) {
    return {
      editorVersion: 2,
      brandName: data.brandName || "Your Business",
      businessGoal: getWebsiteGoal(data.businessGoal || raw?.businessGoal).id,
      contactEmail: data.contactEmail || raw?.supportEmail || "",
      updatedAt: data.updatedAt,
      primaryColor: cleanColor(data.primaryColor, "#18243a"),
      backgroundColor: cleanColor(data.backgroundColor, "#f7f2eb"),
      textColor: cleanColor(data.textColor, "#171513"),
      recentColors: Array.isArray(data.recentColors) && data.recentColors.length ? data.recentColors.map((color) => cleanColor(color)).slice(0, 5) : DEFAULT_RECENT_COLORS,
      sections: savedSections.map((section) => ({
        ...createSection(section.type || "text"),
        ...section,
        id: section.id || createId(section.type || "section"),
        style: { ...createSection(section.type || "text").style, ...(section.style || {}) },
      })),
    };
  }

  const legacyElements = Array.isArray(data.elements) ? data.elements : [];
  const legacyHeading = legacyElements.find((item) => item.type === "heading");
  const legacyText = legacyElements.find((item) => item.type === "text");
  const legacyButton = legacyElements.find((item) => item.type === "button");
  const legacyImage = legacyElements.find((item) => item.type === "image");
  const legacyProducts = legacyElements.filter((item) => item.type === "product");
  const hero = createSection("hero");
  hero.title = data.heroTitle || legacyHeading?.content || hero.title;
  hero.body = data.heroText || legacyText?.content || hero.body;
  hero.buttonText = legacyButton?.content || hero.buttonText;
  hero.image = data.heroImageUrl || legacyImage?.image || "";
  const migratedProducts = legacyProducts.map((item) => createSection("product", {
    id: item.product?.id || item.productId, name: item.content || item.product?.name,
    description: item.product?.description || item.description, imageUrl: item.image || item.product?.image,
    sellingPrice: item.product?.price || item.price,
  }));

  return {
    editorVersion: 2,
    brandName: data.brandName || "Your Business",
      businessGoal: getWebsiteGoal(data.businessGoal || raw?.businessGoal).id,
      contactEmail: data.contactEmail || raw?.supportEmail || "",
      updatedAt: data.updatedAt,
    primaryColor: cleanColor(data.primaryColor, "#18243a"),
    backgroundColor: cleanColor(data.backgroundColor, "#f7f2eb"),
    textColor: "#171513",
    recentColors: DEFAULT_RECENT_COLORS,
    sections: [hero, createSection("about"), ...migratedProducts, createSection("footer")],
  };
}

function isImageFile(file) {
  return file?.type?.startsWith("image/") && file.size <= 8 * 1024 * 1024;
}

export default function WebsiteEditor() {
  const [model, setModel] = useState(() => createDefaultModel());
  const [loaded, setLoaded] = useState(false);
  const cacheKey = useRef(null);
  const [activeTab, setActiveTab] = useState("sections");
  const [selectedId, setSelectedId] = useState(null);
  const [device, setDevice] = useState("laptop");
  const [products, setProducts] = useState([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishUrl, setPublishUrl] = useState("");
  const [status, setStatus] = useState("Saved");
  const [saving, setSaving] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [draggedId, setDraggedId] = useState(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const selected = useMemo(() => model.sections.find((section) => section.id === selectedId) || null, [model.sections, selectedId]);
  const canvasSize = { laptop: "1440 px", ipad: "834 px", phone: "390 px" }[device];

  useEffect(() => {
    let active = true;
    async function loadEditor() {
      try {
        await auth.authStateReady();
        if (!auth.currentUser) { window.location.assign("/login"); return; }
        cacheKey.current = `websiteEditorData:${auth.currentUser.uid}`;
        const store = await getStore();
        const productList = await getProducts().catch(() => []);
        if (!active) return;
        let cached = null;
        try { cached = JSON.parse(localStorage.getItem(cacheKey.current) || "null"); } catch { /* Invalid local draft: use cloud. */ }
        const cloud = store?.draftEditorData || store?.editorData || (store?.sections || store?.elements ? store : null);
        const source = cached && (!cloud || Date.parse(cached.updatedAt || 0) > Date.parse(cloud.updatedAt || 0)) ? cached : cloud;
        const next = source ? migrateLegacyEditor({ ...store, editorData: source }) : createDefaultModel(store || {});
        setModel(next);
        setSelectedId(next.sections[0]?.id || null);
        setLoaded(true);
        setStatus(source === cached && cached ? "Draft on this device" : "Saved");
        setProducts(Array.isArray(productList) ? productList : []);
      } catch (error) {
        console.error("Could not load website editor data:", error);
        if (active) { setStatus("Load failed"); showToast("Could not load your website. Reload before editing."); }
      }
    }
    loadEditor();
    return () => { active = false; };
  }, []);

  useEffect(() => { if (loaded && cacheKey.current) localStorage.setItem(cacheKey.current, JSON.stringify(model)); }, [model, loaded]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }

  function commit(nextModel, options = {}) {
    const { recordHistory = true, message } = options;
    if (recordHistory) {
      setUndoStack((previous) => [...previous, clone(model)].slice(-60));
      setRedoStack([]);
    }
    if (!loaded) return;
    setModel({ ...nextModel, updatedAt: new Date().toISOString() });
    setStatus("Unsaved");
    if (message) showToast(message);
  }

  function updateModelField(field, value) { commit({ ...model, [field]: value }); }
  function addRecentColor(color) {
    const normalized = cleanColor(color);
    return [normalized, ...model.recentColors.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 5);
  }
  function updateGlobalColor(field, color) {
    const normalized = cleanColor(color);
    commit({ ...model, [field]: normalized, recentColors: addRecentColor(normalized) });
  }
  function addSection(type) {
    if (type === "product") { setShowProductPicker(true); return; }
    const section = createSection(type);
    commit({ ...model, sections: [...model.sections, section] }, { message: `${section.label} added` });
    setSelectedId(section.id);
  }
  function addProduct(product) {
    const section = createSection("product", product);
    commit({ ...model, sections: [...model.sections, section] }, { message: "Product added" });
    setSelectedId(section.id);
    setShowProductPicker(false);
  }
  function updateSection(patch) {
    if (!selected) return;
    commit({ ...model, sections: model.sections.map((section) => section.id === selected.id ? { ...section, ...patch } : section) });
  }
  function updateSectionStyle(patch) { if (selected) updateSection({ style: { ...selected.style, ...patch } }); }
  function updateSectionColor(color) {
    if (!selected) return;
    const normalized = cleanColor(color, selected.style?.color || "#171513");
    commit({ ...model, recentColors: addRecentColor(normalized), sections: model.sections.map((section) => section.id === selected.id ? { ...section, style: { ...section.style, color: normalized } } : section) });
  }
  function duplicateSelected() {
    if (!selected) return;
    const copy = { ...clone(selected), id: createId(selected.type), title: selected.title ? `${selected.title} (copy)` : "Copy" };
    const index = model.sections.findIndex((section) => section.id === selected.id);
    const next = [...model.sections]; next.splice(index + 1, 0, copy);
    commit({ ...model, sections: next }, { message: "Section duplicated" }); setSelectedId(copy.id);
  }
  function moveSelected(direction) {
    if (!selected) return;
    const currentIndex = model.sections.findIndex((section) => section.id === selected.id);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= model.sections.length) return;
    const next = [...model.sections]; [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    commit({ ...model, sections: next }, { message: "Section moved" });
  }
  function deleteSelected() {
    if (!selected) return;
    if (model.sections.length === 1) { showToast("Keep at least one section on the page"); return; }
    const index = model.sections.findIndex((section) => section.id === selected.id);
    const next = model.sections.filter((section) => section.id !== selected.id);
    commit({ ...model, sections: next }, { message: "Section deleted" });
    setSelectedId(next[Math.max(0, index - 1)]?.id || next[0]?.id || null);
  }
  function moveDraggedSection(targetId) {
    if (!draggedId || draggedId === targetId) return;
    const sourceIndex = model.sections.findIndex((section) => section.id === draggedId);
    const targetIndex = model.sections.findIndex((section) => section.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...model.sections]; const [moved] = next.splice(sourceIndex, 1);
    next.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, moved);
    commit({ ...model, sections: next }, { message: "Section moved" }); setDraggedId(null);
  }
  async function uploadImage(event, slot = "image") {
    const file = event.target.files?.[0];
    const galleryIndex = Number(event.target.dataset.index || 0);
    event.target.value = "";
    if (!file || !selected) return;
    if (!isImageFile(file)) { showToast("Use an image smaller than 8 MB"); return; }
    setStatus("Uploading image…");
    try {
      const url = await uploadProductImage(file);
      if (slot === "gallery") {
        const images = [...(selected.images || ["", "", ""])]; images[galleryIndex] = url; updateSection({ images });
      } else { updateSection({ image: url }); }
      setStatus("Unsaved"); showToast("Image updated");
    } catch (error) {
      console.error("Image upload failed:", error); setStatus("Image upload failed"); showToast("Image upload failed. Please try again.");
    }
  }
  function undo() {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((items) => items.slice(0, -1)); setRedoStack((items) => [clone(model), ...items].slice(0, 60)); setModel({ ...previous, updatedAt: new Date().toISOString() });
    setSelectedId(previous.sections[0]?.id || null); setStatus("Unsaved");
  }
  function redo() {
    if (!redoStack.length) return;
    const next = redoStack[0]; setRedoStack((items) => items.slice(1)); setUndoStack((items) => [...items, clone(model)].slice(-60)); setModel({ ...next, updatedAt: new Date().toISOString() });
    setSelectedId(next.sections[0]?.id || null); setStatus("Unsaved");
  }
  function editorPayload() {
    return { ...model, editorVersion: 2, elements: model.sections, sections: model.sections, updatedAt: new Date().toISOString() };
  }
  async function saveDraft() {
    setSaving(true); setStatus("Saving…");
    try {
      const payload = editorPayload();
      await saveStore({ draftEditorData: payload, businessGoal: payload.businessGoal });
      localStorage.setItem(cacheKey.current, JSON.stringify(payload)); setStatus("Saved"); showToast("Draft saved");
    } catch (error) {
      console.error("Could not save website editor:", error); setStatus("Save failed"); showToast(error.message || "Could not save your draft");
    } finally { setSaving(false); }
  }
  async function publishWebsite() {
    try { validateBookingSections(model.sections); } catch (error) { showToast(error.message); return; }
    setSaving(true); setStatus("Publishing…");
    try {
      const existingStore = await getStore(); const payload = editorPayload();
      const nextStore = { ...(existingStore || {}), ...payload, editorData: payload, draftEditorData: payload, published: true, publishedAt: new Date().toISOString() };
      await saveStore(nextStore); localStorage.setItem(cacheKey.current, JSON.stringify(payload)); localStorage.setItem("websitePublished", "true"); localStorage.setItem("publicStoreData", JSON.stringify(payload));
      setPublishUrl(nextStore.storeUrl ? `${window.location.origin}/store/${nextStore.storeUrl}` : ""); setStatus("Published"); setShowPublish(true);
    } catch (error) {
      console.error("Could not publish website:", error); setStatus("Publish failed"); showToast(error.message || "Could not publish your website");
    } finally { setSaving(false); }
  }

  function renderSection(section, previewOnly = false) {
    const isSelected = section.id === selectedId && !previewOnly;
    const sectionStyle = { "--section-color": section.style?.color || "#171513", "--section-font": section.style?.fontFamily || "Georgia", "--section-size": `${section.style?.fontSize || 32}px` };
    const editable = !previewOnly;
    const wrapperProps = {
      className: `website-section type-${section.type}${isSelected ? " is-selected" : ""}`,
      style: sectionStyle,
      onClick: () => editable && setSelectedId(section.id),
      onDragOver: (event) => editable && event.preventDefault(),
      onDrop: (event) => { if (!editable) return; event.preventDefault(); moveDraggedSection(section.id); },
      "data-kind": section.label,
    };
    const dragHandle = editable ? <button className="section-drag-handle" type="button" draggable aria-label={`Move ${section.label}`} onClick={(event) => event.stopPropagation()} onDragStart={(event) => { event.stopPropagation(); setDraggedId(section.id); }} onDragEnd={() => setDraggedId(null)}>⠿</button> : null;

    if (section.type === "hero") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-hero`}>{dragHandle}<div className="website-hero-copy"><p className="website-eyebrow">Built for your next chapter</p><h1>{section.title}</h1><p className="website-body">{section.body}</p><button type="button" style={{ backgroundColor: model.primaryColor }}>{section.buttonText || "Get started"}</button></div><div className={`website-hero-media${section.image ? " has-image" : ""}`} style={section.image ? { backgroundImage: `url(${section.image})` } : undefined}>{!section.image && <span>Add your photo</span>}</div></section>;
    if (section.type === "about") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-about`}>{dragHandle}<div className={`website-about-media${section.image ? " has-image" : ""}`} style={section.image ? { backgroundImage: `url(${section.image})` } : undefined}>{!section.image && <span>Your story, visually</span>}</div><div><p className="website-eyebrow">About us</p><h2>{section.title}</h2><p className="website-body">{section.body}</p><button className="website-outline-button" type="button">{section.buttonText || "Learn more"}</button></div></section>;
    if (section.type === "services") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-standard-section`}>{dragHandle}<p className="website-eyebrow">What we offer</p><h2>{section.title}</h2><p className="website-body">{section.body}</p><div className="website-service-grid">{(section.items || []).map((item, index) => <article key={`${item}-${index}`}><span>0{index + 1}</span><h3>{item}</h3><p>Make this service feel clear and worth choosing.</p></article>)}</div></section>;
    if (section.type === "menu") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-standard-section website-menu-section`}>{dragHandle}<p className="website-eyebrow">Menu</p><h2>{section.title}</h2><p className="website-body">{section.body}</p><div className="website-menu-list">{(section.items || []).map((item, index) => <div key={`${item.name}-${index}`}><span>{item.name}</span><b>{item.price}</b></div>)}</div></section>;
    if (section.type === "booking") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-booking-section`}>{dragHandle}<div><p className="website-eyebrow">Appointments</p><h2>{section.title}</h2><p className="website-body">{section.body}</p></div><div className="booking-card"><span>{section.booking?.services?.length ? `${section.booking.services.length} services · ${section.booking.timezone}` : "Add services in Properties to enable booking"}</span><div className="booking-slots"><i>{section.booking?.openTime || "09:00"}</i><i>{section.booking?.closeTime || "18:00"}</i></div><button type="button">{section.buttonText || "Book now"}</button></div></section>;
    if (section.type === "gallery") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-standard-section`}>{dragHandle}<p className="website-eyebrow">Gallery</p><h2>{section.title}</h2><p className="website-body">{section.body}</p><div className="website-gallery-grid">{(section.images || ["", "", ""]).map((image, index) => <div key={`${image}-${index}`} className={image ? "has-image" : ""} style={image ? { backgroundImage: `url(${image})` } : undefined}>{(!image || section.captions?.[index]) && <span>{section.captions?.[index] || `Photo ${index + 1}`}</span>}</div>)}</div></section>;
    if (section.type === "faq") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-standard-section website-faq-section`}>{dragHandle}<p className="website-eyebrow">FAQ</p><h2>{section.title}</h2><p className="website-body">{section.body}</p><div className="website-faq-list">{(section.items || []).map((item, index) => <details key={`${item.question}-${index}`} open={index === 0}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div></section>;
    if (section.type === "product") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-product-section`}>{dragHandle}<div className={`website-product-image${section.image ? " has-image" : ""}`} style={section.image ? { backgroundImage: `url(${section.image})` } : undefined}>{!section.image && <span>Product photo</span>}</div><div><p className="website-eyebrow">Featured product</p><h2>{section.title}</h2><p className="website-body">{section.body}</p><strong>{money(section.price)}</strong><button type="button" style={{ backgroundColor: model.primaryColor }}>Add to cart</button></div></section>;
    if (section.type === "heading") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-simple-section`}>{dragHandle}<h2>{section.title}</h2></section>;
    if (section.type === "text") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-simple-section website-text-section`}>{dragHandle}<p>{section.body}</p></section>;
    if (section.type === "button") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-simple-section website-button-section`}>{dragHandle}<button type="button" style={{ backgroundColor: model.primaryColor }}>{section.buttonText || section.title}</button></section>;
    if (section.type === "photo") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-photo-section${section.image ? " has-image" : ""}`} style={section.image ? { ...sectionStyle, backgroundImage: `url(${section.image})` } : sectionStyle}>{dragHandle}{!section.image && <><h2>{section.title}</h2><p>{section.body}</p></>}</section>;
    if (section.type === "chat") return <section key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-chat-section`}>{dragHandle}<span>✦</span><div><b>{section.title}</b><small>{section.body}</small></div><button type="button">Chat</button></section>;
    return <footer key={section.id} {...wrapperProps} className={`${wrapperProps.className} website-footer`}>{dragHandle}<div><h2>{section.title}</h2><p>{section.body}</p></div><span>© {new Date().getFullYear()} {model.brandName}</span></footer>;
  }

  function propertiesPanel() {
    if (!selected) return <div className="property-empty">Select any section in your website to change its content, type, colour, or position.</div>;
    const supportsTitle = selected.type !== "text";
    const supportsBody = !["heading", "button"].includes(selected.type);
    const supportsButton = ["hero", "about", "booking", "button"].includes(selected.type);
    const supportsImage = ["hero", "about", "photo", "product"].includes(selected.type);
    const supportsGallery = selected.type === "gallery";
    return <>
      <h2 className="selected-heading">{selected.label}</h2><p className="selected-caption">Editing the selected section</p>
      {supportsTitle && <label className="property-field"><span>Heading</span><input value={selected.title || ""} onChange={(event) => updateSection({ title: event.target.value })} /></label>}
      {supportsBody && <label className="property-field"><span>{selected.type === "chat" ? "Message" : "Description"}</span><textarea rows="4" value={selected.body || ""} onChange={(event) => updateSection({ body: event.target.value })} /></label>}
      {supportsButton && <label className="property-field"><span>Button text</span><input value={selected.buttonText || ""} onChange={(event) => updateSection({ buttonText: event.target.value })} /></label>}
      {selected.type === "product" && <label className="property-field"><span>Price (USD)</span><input value={selected.price ?? ""} onChange={(event) => updateSection({ price: event.target.value })} /></label>}
      {selected.type === "chat" && <label className="property-field"><span>Business email</span><input type="email" value={selected.email || ""} onChange={(event) => updateSection({ email: event.target.value })} placeholder="hello@yourbusiness.com" /></label>}
      {supportsImage && <label className="property-field"><span>Image</span><span className="upload-file"><input type="file" accept="image/*" onChange={uploadImage} />Upload image</span>{selected.image && <button type="button" className="remove-image" onClick={() => updateSection({ image: "" })}>Remove image</button>}</label>}
      {supportsGallery && <div className="property-field"><span>Gallery photos</span><div className="gallery-upload-controls">{[0, 1, 2].map((index) => <label key={index} className="upload-file"><input type="file" accept="image/*" data-index={index} onChange={(event) => uploadImage(event, "gallery")} />Photo {index + 1}</label>)}</div></div>}
      {selected.type === "booking" && <BookingFields value={selected.booking} onChange={(booking) => updateSection({ booking })} />}
      {selected.type === "gallery" && <EditableSimpleItems items={selected.captions || ["", "", ""]} label="Project captions" onChange={(captions) => updateSection({ captions })} />}
      {selected.type === "services" && <EditableSimpleItems items={selected.items || []} label="Services" onChange={(items) => updateSection({ items })} />}
      {selected.type === "menu" && <EditableMenuItems items={selected.items || []} onChange={(items) => updateSection({ items })} />}
      {selected.type === "faq" && <EditableFaqItems items={selected.items || []} onChange={(items) => updateSection({ items })} />}
      <div className="property-divider" />
      <div className="property-row"><label className="property-field"><span>Font</span><select value={selected.style?.fontFamily || "Arial"} onChange={(event) => updateSectionStyle({ fontFamily: event.target.value })}>{FONTS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label><label className="property-field"><span>Title size</span><div className="range-input"><input type="range" min="12" max="76" value={selected.style?.fontSize || 16} onChange={(event) => updateSectionStyle({ fontSize: Number(event.target.value) })} /><output>{selected.style?.fontSize || 16}</output></div></label></div>
      <label className="property-field"><span>Text colour</span><div className="colour-input"><input type="color" value={cleanColor(selected.style?.color, "#171513")} onChange={(event) => updateSectionColor(event.target.value)} /><input value={selected.style?.color || "#171513"} onChange={(event) => updateSectionColor(event.target.value)} /></div></label>
      <p className="recent-label">Recently used</p><div className="recent-colours">{model.recentColors.map((color) => <button key={color} type="button" title={color} aria-label={`Use ${color}`} className={color.toLowerCase() === (selected.style?.color || "").toLowerCase() ? "active" : ""} style={{ backgroundColor: color }} onClick={() => updateSectionColor(color)} />)}</div>
      <div className="property-actions"><button type="button" onClick={() => moveSelected(-1)}>Move up</button><button type="button" onClick={() => moveSelected(1)}>Move down</button><button type="button" onClick={duplicateSelected}>Duplicate</button><button type="button" className="danger" onClick={deleteSelected}>Delete</button></div>
    </>;
  }

  return <div className="getcyb-editor">
    <header className="getcyb-editor-topbar">
      <div className="editor-brand"><span className="editor-brand-mark">c</span><strong>getcyb</strong></div>
      <div className="editor-project"><input aria-label="Business name" value={model.brandName} onChange={(event) => updateModelField("brandName", event.target.value || "Your Business")} /><span className={`save-state ${status === "Saved" || status === "Published" ? "saved" : ""}`}>{status}</span></div>
      <div className="topbar-spacer" />
      <div className="history-controls"><button type="button" onClick={undo} disabled={!undoStack.length} aria-label="Undo">↶</button><button type="button" onClick={redo} disabled={!redoStack.length} aria-label="Redo">↷</button></div>
      <div className="device-controls">{[["laptop", "▣", "Laptop"], ["ipad", "▤", "iPad"], ["phone", "▯", "Phone"]].map(([id, icon, label]) => <button type="button" key={id} className={device === id ? "active" : ""} onClick={() => setDevice(id)}>{icon}<span>{label}</span></button>)}</div>
      <button className="topbar-action" type="button" onClick={saveDraft} disabled={saving || !loaded}>Save draft</button><button className="topbar-action" type="button" onClick={() => setShowPreview(true)}>Preview</button><button className="topbar-action primary" type="button" onClick={publishWebsite} disabled={saving || !loaded}>Publish</button>
    </header>
    <div className="getcyb-editor-workspace">
      <aside className="editor-left-panel">
        <nav className="editor-navigation" aria-label="Editor navigation">{[["sections", "Sections", "◫"], ["elements", "Elements", "＋"], ["products", "Products", "◈"], ["design", "Design", "◐"]].map(([id, label, icon]) => <button key={id} type="button" className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}><span>{icon}</span>{label}</button>)}</nav>
        <div className="editor-side-content">
          {activeTab === "sections" && <><div className="side-heading"><span>Add section</span><p>Build a complete business website.</p></div><div className="section-library">{[...SECTION_LIBRARY].sort((a, b) => Number(getWebsiteGoal(model.businessGoal).sections.includes(b.type)) - Number(getWebsiteGoal(model.businessGoal).sections.includes(a.type))).map((item) => <button type="button" key={item.type} onClick={() => addSection(item.type)}><span className="library-thumbnail"><i /><i /><b /></span><span><strong>{item.label}</strong><small>{item.description}</small></span><em>＋</em></button>)}</div></>}
          {activeTab === "elements" && <><div className="side-heading"><span>Add element</span><p>Use these anywhere in your website.</p></div><div className="element-library">{ELEMENT_LIBRARY.map((item) => <button type="button" key={item.type} onClick={() => addSection(item.type)}><b>＋</b>{item.label}</button>)}</div></>}
          {activeTab === "products" && <><div className="side-heading"><span>Your products</span><p>Choose a real product to show on your website.</p></div><button type="button" className="add-real-product" onClick={() => setShowProductPicker(true)}>＋ Add product section</button><div className="side-product-list">{products.length ? products.map((product) => <button type="button" key={product.id} onClick={() => addProduct(product)}><span className="side-product-image" style={product.imageUrl || product.image ? { backgroundImage: `url(${product.imageUrl || product.image})` } : undefined} /><span><strong>{product.name}</strong><small>{money(product.sellingPrice)}</small></span><em>＋</em></button>) : <p className="empty-copy">No products yet. Add one from your Products page first.</p>}</div></>}
          {activeTab === "design" && <><div className="side-heading"><span>Design</span><p>Set the base look of your website.</p></div><label className="property-field"><span>Website purpose</span><select value={model.businessGoal} onChange={(event) => updateModelField("businessGoal", event.target.value)}>{WEBSITE_GOALS.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label><p className="empty-copy">Changing your purpose keeps every existing section. Add any section you need.</p><label className="property-field"><span>Contact email</span><input type="email" value={model.contactEmail || ""} onChange={(event) => updateModelField("contactEmail", event.target.value)} /></label><label className="design-field"><span>Primary colour</span><div className="colour-input"><input type="color" value={cleanColor(model.primaryColor)} onChange={(event) => updateGlobalColor("primaryColor", event.target.value)} /><input value={model.primaryColor} onChange={(event) => updateGlobalColor("primaryColor", event.target.value)} /></div></label><label className="design-field"><span>Background colour</span><div className="colour-input"><input type="color" value={cleanColor(model.backgroundColor, "#f7f2eb")} onChange={(event) => updateGlobalColor("backgroundColor", event.target.value)} /><input value={model.backgroundColor} onChange={(event) => updateGlobalColor("backgroundColor", event.target.value)} /></div></label><p className="recent-label">Recently used</p><div className="recent-colours">{model.recentColors.map((color) => <button key={color} type="button" aria-label={`Use ${color} as primary colour`} style={{ backgroundColor: color }} onClick={() => updateGlobalColor("primaryColor", color)} />)}</div><div className="design-note">Your app stays dark. These colours only change the website your customer sees.</div></>}
        </div>
      </aside>
      <main className="editor-canvas-wrap"><div className="canvas-meta"><span><b>{loaded ? "Live preview" : "Loading your website…"}</b> · click a section to edit it</span><span>{canvasSize}</span></div><div className={`website-canvas ${device}`} style={{ backgroundColor: model.backgroundColor, color: model.textColor }}><header className="website-navbar"><span>{model.brandName}</span><nav><button type="button">Home</button><button type="button">About</button><button type="button">Contact</button></nav><button type="button" style={{ backgroundColor: model.primaryColor }}>Get in touch</button></header>{model.sections.map((section) => renderSection(section))}</div><div className={`section-drop-zone${draggedId ? " active" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!draggedId) return; const moved = model.sections.find((section) => section.id === draggedId); if (!moved) return; const next = [...model.sections.filter((section) => section.id !== draggedId), moved]; commit({ ...model, sections: next }, { message: "Section moved to bottom" }); setDraggedId(null); }}>Drop a section here to move it to the bottom</div></main>
      <aside className="editor-properties-panel"><div className="properties-top"><span>Properties</span><small>{selected ? "Selected" : "Nothing selected"}</small></div>{propertiesPanel()}</aside>
    </div>
    {showProductPicker && <div className="editor-modal-backdrop" role="presentation" onMouseDown={() => setShowProductPicker(false)}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="product-picker-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setShowProductPicker(false)} aria-label="Close">×</button><p className="modal-kicker">Your products</p><h2 id="product-picker-title">What product do you want to add?</h2><p>Select a product that already exists in your GetCyb Products page.</p><div className="picker-products">{products.length ? products.map((product) => <button type="button" key={product.id} onClick={() => addProduct(product)}><span className="picker-product-image" style={product.imageUrl || product.image ? { backgroundImage: `url(${product.imageUrl || product.image})` } : undefined} /><span><strong>{product.name}</strong><small>{product.description || "No description yet"}</small></span><b>{money(product.sellingPrice)}</b></button>) : <div className="empty-picker">No products yet. Add a product from the Products page, then come back here.</div>}</div></section></div>}
    {showPreview && <div className="full-preview"><header><span>Previewing your website</span><button type="button" onClick={() => setShowPreview(false)}>Back to editor</button></header><div className="full-preview-site"><div className="website-canvas laptop" style={{ backgroundColor: model.backgroundColor, color: model.textColor }}><header className="website-navbar"><span>{model.brandName}</span><nav><button type="button">Home</button><button type="button">About</button><button type="button">Contact</button></nav><button type="button" style={{ backgroundColor: model.primaryColor }}>Get in touch</button></header>{model.sections.map((section) => renderSection(section, true))}</div></div></div>}
    {showPublish && <div className="editor-modal-backdrop" role="presentation"><section className="editor-modal publish-modal" role="dialog" aria-modal="true"><p className="modal-kicker">Published</p><h2>Your website is live.</h2><p>Your last design is now saved to your GetCyb store and will be shown on your public website.</p>{publishUrl ? <a href={publishUrl} target="_blank" rel="noreferrer">Open your website ↗</a> : <div className="publish-missing-url">Finish Store Setup to choose your public website address.</div>}<button className="topbar-action" type="button" onClick={() => setShowPublish(false)}>Done</button></section></div>}
    {toast && <div className="editor-toast" role="status">{toast}</div>}
  </div>;
}

function EditableSimpleItems({ items, label, onChange }) {
  function update(index, value) { onChange(items.map((item, itemIndex) => itemIndex === index ? value : item)); }
  function remove(index) { onChange(items.filter((_, itemIndex) => itemIndex !== index)); }
  return <div className="property-field"><span>{label}</span>{items.map((item, index) => <div className="repeater-row" key={`${item}-${index}`}><input value={item} onChange={(event) => update(index, event.target.value)} /><button type="button" onClick={() => remove(index)} aria-label="Remove">×</button></div>)}<button className="add-repeater" type="button" onClick={() => onChange([...items, "New item"])}>＋ Add item</button></div>;
}

function EditableMenuItems({ items, onChange }) {
  function update(index, patch) { onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  return <div className="property-field"><span>Menu items</span>{items.map((item, index) => <div className="menu-repeater" key={`${item.name}-${index}`}><input value={item.name} onChange={(event) => update(index, { name: event.target.value })} /><input value={item.price} onChange={(event) => update(index, { price: event.target.value })} /></div>)}<button className="add-repeater" type="button" onClick={() => onChange([...items, { name: "New item", price: "$0" }])}>＋ Add item</button></div>;
}

function EditableFaqItems({ items, onChange }) {
  function update(index, patch) { onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  return <div className="property-field"><span>Questions</span>{items.map((item, index) => <div className="faq-repeater" key={`${item.question}-${index}`}><input value={item.question} onChange={(event) => update(index, { question: event.target.value })} /><textarea rows="2" value={item.answer} onChange={(event) => update(index, { answer: event.target.value })} /></div>)}<button className="add-repeater" type="button" onClick={() => onChange([...items, { question: "New question", answer: "New answer" }])}>＋ Add question</button></div>;
}
