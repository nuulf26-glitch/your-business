import TrialBanner from "../components/TrialBanner";
import { EDITOR_MODES, editorMode, patchPageSection, publishWarnings } from "../editor/editorState";
import { validateImage, IMAGE_ACCEPT } from "../services/imagePolicy";
import { businessCall } from "../business/api";
import { groupSections, ungroupSections, mediaAssets } from "../editor/structure";
import { publishSnapshot, websiteVersions, loadWebsiteDraft, saveWebsiteDraft, unpublishWebsite } from "../editor/versionService";
import WebsiteRenderer, { WebsiteSection, sectionStyle } from "../editor/WebsiteRenderer";
import { websitePages, changePageSections, addWebsitePage, pageSlug, reorderPage } from "../editor/pages";
import { DESIGN_COLLECTIONS, collectionSections, collectionWebsite } from "../editor/collections";
import { auth } from "../firebase";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStore } from "../services/storeService";
import { getProducts } from "../services/productService";
import { uploadProductImage } from "../services/imageService";
import "../styles/websiteEditor.css";
import "../styles/editorControls.css";

const FONTS = [
  "Inter", "DM Sans", "Playfair Display",
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
  { type: "collection", label: "Product collection", description: "Your published product catalogue" },
  { type: "gallery", label: "Gallery", description: "Show your work" },
  { type: "contact", label: "Contact form", description: "Receive customer inquiries" },
  { type: "divider", label: "Divider", description: "A quiet visual break" },
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
    collection: { ...common, label: "Collection", title: "The collection", body: "Explore our latest products." },
    contact: { ...common, label: "Contact", title: "Let’s talk.", body: "Tell us what you have in mind." },
    divider: { ...common, label: "Divider", title: "", body: "" },
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
      buttonText: "Book now", style: { ...common.style, fontSize: 34, color: "#ffffff" },
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

function createDefaultModel() {
  return {
    editorVersion: 2,
    brandName: "Your Business",
    primaryColor: "#18243a",
    backgroundColor: "#f7f2eb",
    textColor: "#171513",
    recentColors: DEFAULT_RECENT_COLORS,
    sections: [createSection("hero"), createSection("about"), createSection("services"), createSection("footer")],
  };
}

function migrateLegacyEditor(raw) {
  const data = raw?.editorData || raw || {};
  const savedSections = data.sections || (data.editorVersion === 2 ? data.elements : null);

  if (Array.isArray(savedSections)) {
    return {
      ...data,
      editorVersion: 2,
      brandName: data.brandName || "Your Business",
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
    primaryColor: cleanColor(data.primaryColor, "#18243a"),
    backgroundColor: cleanColor(data.backgroundColor, "#f7f2eb"),
    textColor: "#171513",
    recentColors: DEFAULT_RECENT_COLORS,
    sections: [hero, createSection("about"), ...migratedProducts, createSection("footer")],
  };
}

const editorServices = {
  userId: () => auth.currentUser?.uid,
  getStore, getProducts, loadWebsiteDraft, saveWebsiteDraft, publishSnapshot, uploadProductImage,
  catalog: () => businessCall('businessCatalog'),
};

export default function WebsiteEditor({ services = editorServices }) {
  const cacheKey = `websiteEditorData:${services.userId()}`;
  const [mode, setMode] = useState(() => { try { return editorMode(localStorage.getItem(`${cacheKey}:mode`)); } catch { return 'advanced'; } });
  const [mobilePanel, setMobilePanel] = useState('canvas');
  const [showPublishReview, setShowPublishReview] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [loadWarning, setLoadWarning] = useState('');
  const [saveError, setSaveError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);
  const revisionRef = useRef(0);
  const operationRef = useRef(false);
  const uploadRef = useRef(false);
  const savedModelRef = useRef(null);
  const activePageRef = useRef('home');
  const [model, setModel] = useState(createDefaultModel);
  const [loaded, setLoaded] = useState(false);
  const [activePageId, setActivePageId] = useState("home");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [collectionPreview, setCollectionPreview] = useState(null);
  const [selectedLayers, setSelectedLayers] = useState([]);
  const [versions, setVersions] = useState([]);
  const [savedSections, setSavedSections] = useState([]);
  const [zoom, setZoom] = useState(100);
  const [copiedSection, setCopiedSection] = useState(null);
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
  const currentModel = useRef(model);
  currentModel.current = model;

  const pages = websitePages(model);
  const activePage = pages.find(page => page.id === activePageId) || pages[0];
  activePageRef.current = activePage.id;
  const visibleSections = activePage.sections;
  const selected = useMemo(() => visibleSections.find((section) => section.id === selectedId) || null, [visibleSections, selectedId]);
  const canvasSize = { laptop: "Laptop · fluid", ipad: "iPad · up to 834 px", phone: "Phone · 390 px" }[device];

  useEffect(() => {
    let active = true;
    async function loadEditor() {
      try {
        const [store, workspace, productsResult, catalogResult] = await Promise.all([
          services.getStore(), services.loadWebsiteDraft(),
          services.getProducts().then(value => ({value})).catch(error => ({error})),
          services.catalog().then(value => ({value})).catch(error => ({error})),
        ]);
        const privateDraft = workspace.model;
        const productList = productsResult.value || [];
        revisionRef.current = workspace.revision;
        if (active) {
          setCatalog(catalogResult.value || null);
          setLoadWarning([productsResult.error && 'Products could not load. Reload before checking product sections.', catalogResult.error && 'Business content could not load. Live menu and services previews may be incomplete.'].filter(Boolean).join(' '));
        }
        if (!active) return;
        if (privateDraft || store?.editorData || store?.sections || store?.elements) {
          let next = migrateLegacyEditor(privateDraft || store);
          savedModelRef.current = next;
          let recovered = false;
          try {
            const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
            if (cached?.dirty && cached.model && window.confirm('Restore unsaved changes from this device?')) { next = migrateLegacyEditor(cached.model); recovered = true; }
          } catch { /* A damaged device cache never prevents loading the cloud draft. */ }
          currentModel.current = next;
          setModel(next);
          setSavedSections(next.savedSections || []);
          setSelectedId(next.sections[0]?.id || null);
          setStatus(recovered ? "Unsaved" : "Saved");
        } else {
          const initial = { ...currentModel.current, brandName: store?.businessName || store?.storeName || currentModel.current.brandName };
          currentModel.current = initial; savedModelRef.current = initial; setModel(initial);
          setSelectedId((current) => current || model.sections[0]?.id || null);
        }
        setProducts(Array.isArray(productList) ? productList : []);
        setLoaded(true);
      } catch (error) {
        console.error("Could not load website editor data:", error);
        if (active) setStatus("Load failed — reload before editing");
      }
    }
    loadEditor();
    return () => { active = false; };
  }, []);

  useEffect(() => { if (loaded) {
    try { localStorage.setItem(cacheKey, JSON.stringify({ model, dirty: model !== savedModelRef.current })); }
    catch { /* Cloud saves remain available if device storage is full. */ }
  } }, [model, loaded, cacheKey, status]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    const warn = event => { if(currentModel.current !== savedModelRef.current || uploadRef.current) { event.preventDefault(); event.returnValue=''; } };
    window.addEventListener('beforeunload',warn);
    return () => window.removeEventListener('beforeunload',warn);
  },[status]);

  useEffect(() => {
    if (!loaded || saving || status !== 'Unsaved' || uploadProgress !== null) return;
    const timer = setTimeout(() => saveDraft(),2000);
    return () => clearTimeout(timer);
  },[model,loaded,saving,status,uploadProgress]);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }

  function commit(nextModel, options = {}) {
    const previousModel = currentModel.current;
    if (nextModel.sections !== previousModel.sections && nextModel.pages === previousModel.pages) {
      nextModel = changePageSections(previousModel, activePageRef.current, nextModel.sections);
    }
    const { recordHistory = true, message } = options;
    if (recordHistory) {
      setUndoStack((previous) => [...previous, clone(previousModel)].slice(-60));
      setRedoStack([]);
    }
    currentModel.current = nextModel;
    setModel(nextModel);
    setSavedSections(nextModel.savedSections || []);
    setStatus(saveError ? "Save failed" : "Unsaved");
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
    commit({ ...model, sections: [...visibleSections, section] }, { message: `${section.label} added` });
    setSelectedId(section.id);
  }
  function addProduct(product) {
    const section = createSection("product", product);
    commit({ ...model, sections: [...visibleSections, section] }, { message: "Product added" });
    setSelectedId(section.id);
    setShowProductPicker(false);
  }
  function updateSection(patch) {
    if (!selected || selected.locked) return;
    commit({ ...model, sections: visibleSections.map((section) => section.id === selected.id ? { ...section, ...patch } : section) });
  }
  function updateSectionStyle(patch) {
    if (!selected) return;
    if (device === 'laptop') updateSection({ style: { ...selected.style, ...patch } });
    else updateSection({ responsive: { ...selected.responsive, [device]: { ...selected.responsive?.[device], ...patch } } });
  }
  function updateSectionColor(color) {
    if (!selected || selected.locked) return;
    const normalized = cleanColor(color, selected.style?.color || "#171513");
    commit({ ...model, recentColors: addRecentColor(normalized), sections: visibleSections.map((section) => section.id === selected.id ? { ...section, style: { ...section.style, color: normalized } } : section) });
  }
  function duplicateSelected() {
    if (!selected) return;
    const copy = { ...clone(selected), id: createId(selected.type), title: selected.title ? `${selected.title} (copy)` : "Copy" };
    const index = visibleSections.findIndex((section) => section.id === selected.id);
    const next = [...visibleSections]; next.splice(index + 1, 0, copy);
    commit({ ...model, sections: next }, { message: "Section duplicated" }); setSelectedId(copy.id);
  }
  function moveSelected(direction) {
    if (!selected || selected.locked) return;
    const currentIndex = visibleSections.findIndex((section) => section.id === selected.id);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= visibleSections.length) return;
    const next = [...visibleSections]; [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    commit({ ...model, sections: next }, { message: "Section moved" });
  }
  function deleteSelected() {
    if (!selected || selected.locked) return;
    if (visibleSections.length === 1) { showToast("Keep at least one section on the page"); return; }
    const index = visibleSections.findIndex((section) => section.id === selected.id);
    const next = visibleSections.filter((section) => section.id !== selected.id);
    commit({ ...model, sections: next }, { message: "Section deleted" });
    setSelectedId(next[Math.max(0, index - 1)]?.id || next[0]?.id || null);
  }
  function moveDraggedSection(targetId) {
    if (!draggedId || draggedId === targetId) return;
    const sourceIndex = visibleSections.findIndex((section) => section.id === draggedId);
    const targetIndex = visibleSections.findIndex((section) => section.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || visibleSections[sourceIndex].locked) return;
    const next = [...visibleSections]; const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    commit({ ...model, sections: next }, { message: "Section moved" }); setDraggedId(null);
  }
  async function uploadImage(event, slot = "image", sectionId = selected?.id) {
    const file = event.target.files?.[0];
    const galleryIndex = Number(event.target.dataset.index || 0);
    const targetPage = activePage.id;
    event.target.value = "";
    if (!file || !sectionId || uploadRef.current) return;
    try { validateImage(file); } catch(error) { showToast(error.message); return; }
    uploadRef.current = true; setUploadProgress(0);
    try {
      const url = await services.uploadProductImage(file, setUploadProgress);
      const next = patchPageSection(currentModel.current, targetPage, sectionId, section => {
        if (slot !== 'gallery') return { ...section, image: url };
        const images = [...(section.images || [])]; images[galleryIndex] = url;
        return { ...section, images };
      });
      commit(next, { message: 'Image updated' });
    } catch (error) { showToast(error.message || 'Image upload failed. Your existing image is unchanged.'); }
    finally { uploadRef.current = false; setUploadProgress(null); }
  }
  async function uploadLogo(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || uploadRef.current) return;
    try { validateImage(file); } catch(error) { showToast(error.message); return; }
    uploadRef.current = true; setUploadProgress(0);
    try { const logo = await services.uploadProductImage(file,setUploadProgress); commit({...currentModel.current,logo}); }
    catch(error) { showToast(error.message); }
    finally { uploadRef.current = false; setUploadProgress(null); }
  }
  function undo() {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((items) => items.slice(0, -1)); setRedoStack((items) => [clone(model), ...items].slice(0, 60)); currentModel.current = previous; setModel(previous);
    setActivePageId(websitePages(previous)[0].id); setSelectedId(previous.sections[0]?.id || null); setStatus("Unsaved");
  }
  function redo() {
    if (!redoStack.length) return;
    const next = redoStack[0]; setRedoStack((items) => items.slice(1)); setUndoStack((items) => [...items, clone(model)].slice(-60)); currentModel.current = next; setModel(next);
    setActivePageId(websitePages(next)[0].id); setSelectedId(next.sections[0]?.id || null); setStatus("Unsaved");
  }
  function editorPayload(source) {
    return { ...source, editorVersion: 2, elements: source.sections, updatedAt: new Date().toISOString() };
  }
  async function saveDraft() {
    if (operationRef.current || uploadRef.current) return;
    operationRef.current = true; setSaving(true); setStatus('Saving…'); setSaveError('');
    const source = currentModel.current;
    try {
      const result = await services.saveWebsiteDraft(editorPayload(source), revisionRef.current);
      revisionRef.current = result.revision; savedModelRef.current = source;
      setStatus(currentModel.current === source ? 'Saved' : 'Unsaved');
    } catch (error) {
      setStatus('Save failed'); setSaveError(error.message || 'Could not save your draft. Your edits remain on this device.');
    } finally { operationRef.current = false; setSaving(false); }
  }
  async function publishWebsite() {
    if (operationRef.current || uploadRef.current) return;
    operationRef.current = true; setSaving(true); setStatus('Publishing…'); setSaveError('');
    const source = currentModel.current;
    try {
      const existingStore = await services.getStore();
      if (!existingStore?.storeUrl) throw new Error('Finish Store Setup before publishing.');
      const result = await services.publishSnapshot(editorPayload(source), revisionRef.current);
      revisionRef.current = result.revision; savedModelRef.current = source;
      setPublishUrl(`${window.location.origin}/store/${result.slug}`);
      setStatus(currentModel.current === source ? 'Published' : 'Unsaved');
      setShowPublishReview(false); setShowPublish(true);
    } catch (error) {
      setStatus('Publish failed'); setSaveError(error.message || 'Could not publish your website. Your draft is safe.');
    } finally { operationRef.current = false; setSaving(false); }
  }
  function switchMode(value) {
    const next = editorMode(value); setMode(next);
    try { localStorage.setItem(`${cacheKey}:mode`,next); } catch { /* Preferences never block editing. */ }
    if (next === 'simple' && !['pages','sections','assets'].includes(activeTab)) setActiveTab('pages');
  }
  function editText(id, field, value) {
    const original = visibleSections.find(section => section.id === id);
    if (original?.locked || original?.[field] === value) return;
    commit({ ...model, sections: visibleSections.map(section => section.id === id ? { ...section, [field]: value } : section) });
  }
  function renderSection(section) {
    const editable = !section.locked;
    return <section key={section.id} id={section.anchor || section.id} className={`cyb-section editor-section ${selectedId === section.id ? 'selected' : ''}`} style={sectionStyle(section, device)} onClick={event => {
      if (event.target.closest("a")) event.preventDefault();
      setSelectedId(section.id);
      if (section.locked || !["hero", "about", "photo"].includes(section.type)) return;
      const heroImageArea = section.type === "hero" && event.target.closest(".cyb-hero") && !event.target.closest(".cyb-hero-copy");
      const aboutImageArea = section.type === "about" && (event.target.closest(".cyb-about .cyb-image") || (event.target.classList?.contains("cyb-about") && event.nativeEvent.offsetX < event.currentTarget.clientWidth / 2));
      const photoImageArea = section.type === "photo" && event.target.closest(".cyb-image");
      if (heroImageArea || aboutImageArea || photoImageArea) event.currentTarget.querySelector('input[data-cyb-image-upload]')?.click();
    }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); moveDraggedSection(section.id); }}>
      <div className="editor-section-label"><span>{section.label} {section.locked ? '· Locked' : ''}</span>{editable && <button type="button" draggable aria-label={`Move ${section.label}`} onDragStart={() => setDraggedId(section.id)} onDragEnd={() => setDraggedId(null)}>⠿</button>}</div>
      <WebsiteSection section={section} model={{...model,renderDevice:device}} products={products} catalog={catalog} editText={editText} />
      {["hero", "about", "photo"].includes(section.type) && !section.locked && <input data-cyb-image-upload type="file" accept={IMAGE_ACCEPT} aria-label={`Upload image for ${section.label}`} style={{ display: "none" }} onChange={event => uploadImage(event, "image", section.id)} />}
    </section>;
  }
  function choosePage(page) { setActivePageId(page.id); setSelectedId(page.sections[0]?.id || null); }
  function addPage() {
    try { const next = addWebsitePage(model, newPageTitle, createId('page')); commit(next); choosePage(next.pages.at(-1)); setNewPageTitle(''); } catch (error) { showToast(error.message); }
  }
  function applyCollection(collection) {
    const sections = collectionSections(collection, createSection);
    commit({ ...model, sections: [...visibleSections, ...sections] }, { message: 'Collection sections added. Your existing content is preserved.' });
    setSelectedId(sections[0].id); setCollectionPreview(null);
  }
  function addCollectionPages(collection) {
    const template = collectionWebsite(collection,createSection);
    const prefix = `${collection.id}-${Date.now().toString(36)}`;
    const incoming = template.pages.map(page => ({ ...page, id: `${prefix}-${page.id}`, slug: `${prefix}${page.slug ? `-${page.slug}` : ''}`, title: `${collection.name} · ${page.title}` }));
    commit({ ...model,pages:[...pages,...incoming] },{message:'Four collection pages added. Rename their addresses in Pages.'});
    choosePage(incoming[0]);setCollectionPreview(null);
  }
  function propertiesPanel() {
    if (!selected) return <div className="property-empty">Select any section in your website to change its content, type, colour, or position.</div>;
    const supportsTitle = selected.type !== "text";
    const supportsBody = !["heading", "button"].includes(selected.type);
    const supportsButton = ["hero", "about", "booking", "button"].includes(selected.type);
    const supportsImage = ["hero", "about", "photo", "product"].includes(selected.type);
    const supportsGallery = selected.type === "gallery";
    const displayStyle = { ...selected.style, ...selected.responsive?.[device] };
    return <>
      <button type="button" className="topbar-action" onClick={() => commit({ ...model, sections: visibleSections.map(item => item.id === selected.id ? { ...item, locked: !item.locked } : item) })}>{selected.locked ? "Unlock section" : "Lock section"}</button>
      <h2 className="selected-heading">{selected.label}</h2><p className="selected-caption">Editing the selected section</p>
      {supportsTitle && <label className="property-field"><span>Heading</span><input value={selected.title || ""} onChange={(event) => updateSection({ title: event.target.value })} /></label>}
      {supportsBody && <label className="property-field"><span>{selected.type === "chat" ? "Message" : "Description"}</span><textarea rows="4" value={selected.body || ""} onChange={(event) => updateSection({ body: event.target.value })} /></label>}
      {supportsButton && <label className="property-field"><span>Button destination</span><input value={selected.href || ""} placeholder="https://… or #section-id" onChange={event => updateSection({ href: event.target.value })} /></label>}
      {supportsImage && <label className="property-field"><span>Image description (alt text)</span><input value={selected.alt || ""} onChange={event => updateSection({ alt: event.target.value })} /></label>}
      {supportsButton && <label className="property-field"><span>Button text</span><input value={selected.buttonText || ""} onChange={(event) => updateSection({ buttonText: event.target.value })} /></label>}
      {selected.type === "product" && <label className="property-field"><span>Price (USD)</span><input value={selected.price ?? ""} onChange={(event) => updateSection({ price: event.target.value })} /></label>}
      {selected.type === "chat" && <label className="property-field"><span>Business email</span><input type="email" value={selected.email || ""} onChange={(event) => updateSection({ email: event.target.value })} placeholder="hello@yourbusiness.com" /></label>}
      {supportsImage && <label className="property-field"><span>Image</span><span className="upload-file"><input type="file" accept={IMAGE_ACCEPT} onChange={uploadImage} />Upload image</span>{selected.image && <button type="button" className="remove-image" onClick={() => updateSection({ image: "" })}>Remove image</button>}</label>}
      {supportsGallery && <div className="property-field"><span>Gallery photos</span><div className="gallery-upload-controls">{[0, 1, 2].map((index) => <label key={index} className="upload-file"><input type="file" accept={IMAGE_ACCEPT} data-index={index} onChange={(event) => uploadImage(event, "gallery")} />Photo {index + 1}</label>)}</div></div>}
      {['services','menu','gallery'].includes(selected.type) && <label className="property-field"><span>Content source</span><select value={selected.dataSource || 'custom'} onChange={event => updateSection({ dataSource: event.target.value })}><option value="custom">Custom section content</option><option value="catalog">Business workspace</option></select></label>}
      {selected.type === "services" && <EditableSimpleItems items={selected.items || []} label="Services" onChange={(items) => updateSection({ items })} />}
      {selected.type === "menu" && <EditableMenuItems items={selected.items || []} onChange={(items) => updateSection({ items })} />}
      {selected.type === "faq" && <EditableFaqItems items={selected.items || []} onChange={(items) => updateSection({ items })} />}
      {mode !== 'simple' && <details className="editor-design-settings" key={mode} open={mode === 'professional'}>
      <summary>Design & responsive settings</summary>
      <p className="selected-caption">Layout overrides: {device === 'laptop' ? 'Base / Laptop' : device === 'ipad' ? 'iPad' : 'Phone'}</p>
      <label className="property-field"><span>Maximum width (px)</span><input type="number" min="280" max="2400" value={displayStyle.maxWidth || ''} placeholder="Full width" onChange={event=>updateSectionStyle({maxWidth:event.target.value ? Math.max(280,Math.min(2400,Number(event.target.value))):null})}/></label><label className="property-field"><span>Minimum height (px)</span><input type="number" min="0" max="1600" value={displayStyle.minHeight || ''} onChange={event=>updateSectionStyle({minHeight:Math.max(0,Math.min(1600,Number(event.target.value)))})}/></label>
      <label className="property-field"><span>Letter spacing (em)</span><input type="number" step="0.01" min="-0.1" max="1" value={selected.responsive?.[device]?.letterSpacing ?? selected.style?.letterSpacing ?? 0} onChange={event => updateSectionStyle({ letterSpacing: Math.min(1,Math.max(-0.1,Number(event.target.value))) })} /></label>
      <label className="property-field"><span>Line height</span><input type="number" step="0.05" min="0.8" max="3" value={selected.responsive?.[device]?.lineHeight ?? selected.style?.lineHeight ?? 1.05} onChange={event => updateSectionStyle({ lineHeight: Math.min(3,Math.max(0.8,Number(event.target.value))) })} /></label>
      <label className="property-field"><span>Section anchor</span><input value={selected.anchor || selected.id} onChange={event => updateSection({ anchor: pageSlug(event.target.value) })} /></label>
      <label className="property-field"><span>Visibility on this device</span><select value={selected.responsive?.[device]?.hidden ? 'hidden' : 'visible'} onChange={event => updateSection({ responsive: { ...selected.responsive, [device]: { ...selected.responsive?.[device], hidden: event.target.value === 'hidden' } } })}><option value="visible">Visible</option><option value="hidden">Hidden</option></select></label>
      <label className="property-field"><span>Alignment</span><select value={displayStyle.textAlign || "left"} onChange={event => updateSectionStyle({ textAlign: event.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
      <label className="property-field"><span>Vertical padding (px)</span><input type="number" min="0" max="240" value={displayStyle.paddingY ?? 64} onChange={event => updateSectionStyle({ paddingY: Math.min(240, Math.max(0, Number(event.target.value))) })} /></label>
      <label className="property-field"><span>Section background</span><input type="color" value={displayStyle.backgroundColor || model.backgroundColor} onChange={event => updateSectionStyle({ backgroundColor: event.target.value })} /></label>

      <div className="property-row"><label className="property-field"><span>Font</span><select value={displayStyle.fontFamily || "Arial"} onChange={(event) => updateSectionStyle({ fontFamily: event.target.value })}>{FONTS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label><label className="property-field"><span>Title size</span><div className="range-input"><input type="range" min="12" max="76" value={displayStyle.fontSize || 16} onChange={(event) => updateSectionStyle({ fontSize: Number(event.target.value) })} /><output>{displayStyle.fontSize || 16}</output></div></label></div>
      <label className="property-field"><span>Text colour</span><div className="colour-input"><input type="color" value={cleanColor(selected.style?.color, "#171513")} onChange={(event) => updateSectionColor(event.target.value)} /><input value={selected.style?.color || "#171513"} onChange={(event) => updateSectionColor(event.target.value)} /></div></label>
      <p className="recent-label">Recently used</p><div className="recent-colours">{model.recentColors.map((color) => <button key={color} type="button" title={color} aria-label={`Use ${color}`} className={color.toLowerCase() === (selected.style?.color || "").toLowerCase() ? "active" : ""} style={{ backgroundColor: color }} onClick={() => updateSectionColor(color)} />)}</div>
      </details>}
      <div className="property-actions"><button type="button" onClick={() => moveSelected(-1)}>Move up</button><button type="button" onClick={() => moveSelected(1)}>Move down</button><button type="button" onClick={duplicateSelected}>Duplicate</button><button type="button" className="danger" onClick={deleteSelected}>Delete</button></div>
    </>;
  }

  if (!loaded) return <main role="status" style={{ padding: 40 }}>{status.startsWith("Load failed") ? status : "Loading your website…"}</main>;

  return <div className={`getcyb-editor editor-mode-${mode} editor-mobile-${mobilePanel}`}>
    {!services.previewOnly && <TrialBanner compact />}
    {loadWarning && <div className="editor-warning" role="status">{loadWarning}</div>}
    {saveError && <div className="editor-warning" role="alert"><span>{saveError}</span><button type="button" disabled={saving} onClick={saveDraft}>Retry save</button><button type="button" onClick={() => window.location.reload()}>Reload & review</button></div>}
    {uploadProgress !== null && <div className="editor-upload-progress" role="status">Uploading image · {uploadProgress}%</div>}
    <header className="getcyb-editor-topbar">
      <div className="editor-brand"><span className="editor-brand-mark">c</span><strong>getcyb</strong></div>
      <div className="editor-project"><input aria-label="Business name" value={model.brandName} onChange={(event) => updateModelField("brandName", event.target.value || "Your Business")} /><span className={`save-state ${status === "Saved" || status === "Published" ? "saved" : ""}`}>{status}</span></div>
      <div className="topbar-spacer" />
      <label className="editor-mode-picker"><span>Editing mode</span><select aria-label="Editing mode" value={mode} onChange={event => switchMode(event.target.value)}>{EDITOR_MODES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="history-controls"><button type="button" onClick={undo} disabled={!undoStack.length} aria-label="Undo">↶</button><button type="button" onClick={redo} disabled={!redoStack.length} aria-label="Redo">↷</button></div>
      <div className="device-controls">{[["laptop", "▣", "Laptop"], ["ipad", "▤", "iPad"], ["phone", "▯", "Phone"]].map(([id, icon, label]) => <button type="button" key={id} className={device === id ? "active" : ""} onClick={() => setDevice(id)}>{icon}<span>{label}</span></button>)}</div>
      <button className="topbar-action" type="button" onClick={saveDraft} disabled={saving}>Save draft</button><button className="topbar-action" type="button" onClick={() => setShowPreview(true)}>Preview</button><button className="topbar-action primary" type="button" onClick={() => setShowPublishReview(true)} disabled={saving || uploadProgress !== null}>Publish</button>
    </header>
    <nav className="editor-mobile-controls" aria-label="Editor workspace">{[['tools','Add & pages'],['canvas','Website'],['properties','Edit selected']].map(([id,label]) => <button type="button" key={id} aria-pressed={mobilePanel === id} onClick={() => setMobilePanel(id)}>{label}</button>)}</nav>
    <div className="editor-mode-hint">{EDITOR_MODES.find(item => item.id === mode).description} <span>Switch modes anytime. Your design stays the same.</span></div>
    <div className="getcyb-editor-workspace">
      <aside className="editor-left-panel">
        <nav className="editor-navigation" aria-label="Editor navigation">{[['pages','Pages','▤'],['sections','Add section','＋'],...(mode === 'simple' ? [] : [['design','Brand & design','◐']]),['assets','Media','▧'],...(mode === 'professional' ? [['layers','Layers','☷']] : [])].map(([id,label,icon]) => <button type="button" key={id} className={activeTab===id?'active':''} onClick={() => setActiveTab(id)}><span aria-hidden="true">{icon}</span>{label}</button>)}
        <details className="editor-more-tools"><summary>More tools</summary>{[['elements','Elements'],['products','Products'],['collections','Templates & reusable sections'],['history','Published versions'],['layers','Layers'],['design','Brand & design']].map(([id,label]) => <button type="button" key={id} onClick={() => setActiveTab(id)}>{label}</button>)}</details></nav>
        <div className="editor-side-content">
          {activeTab === "assets" && <><div className="side-heading"><span>Media library</span><p>Images already used in this website. Select a photo section, then choose an image.</p></div><div className="editor-assets">{mediaAssets(model).map(url => <button type="button" key={url} onClick={() => selected ? updateSection({image:url}) : showToast('Select a section first')}><img src={url} alt="Website asset" loading="lazy" /></button>)}</div>{!mediaAssets(model).length && <p className="empty-copy">Upload your first image from section properties or Brand Kit.</p>}</>}
          {activeTab === "history" && <><div className="side-heading"><span>Published versions</span><p>Restore a version as a draft. Publish separately when ready.</p></div><button type="button" className="topbar-action" onClick={async () => { try { setVersions(await websiteVersions()); } catch(error) { showToast(error.message); } }}>Load latest 10 versions</button><div className="page-list">{versions.map(version => <div key={version.id}><button type="button" onClick={() => { commit(migrateLegacyEditor(version.model)); setActivePageId(websitePages(version.model)[0].id); showToast('Version restored as draft'); }}>{new Date(version.publishedAt).toLocaleString()}</button></div>)}</div><button type="button" className="topbar-action" disabled={saving} onClick={async () => { if (!window.confirm('Unpublish this website? Your saved content stays available.')) return; setSaving(true); try { await unpublishWebsite(); showToast('Website unpublished'); } catch(error) { showToast(error.message); } finally { setSaving(false); } }}>Unpublish website</button></>}
          {activeTab === "pages" && <><div className="side-heading"><span>Website pages</span><p>Every page shares your brand and navigation.</p></div><div className="page-list">{pages.map((page, index) => <div key={page.id}><button type="button" className={activePage.id === page.id ? 'active' : ''} onClick={() => choosePage(page)}>{page.title}<small>/{page.slug}</small></button>{index > 0 && <button type="button" aria-label={`Delete ${page.title}`} onClick={() => { if (window.confirm(`Delete ${page.title}? Undo can restore it.`)) { commit({ ...model, pages: pages.filter(item => item.id !== page.id) }); choosePage(pages[0]); } }}>×</button>}</div>)}</div><label className="property-field"><span>New page name</span><input value={newPageTitle} onChange={event => setNewPageTitle(event.target.value)} /></label><button type="button" className="topbar-action" onClick={addPage}>Add page</button><div className="property-divider" /><label className="property-field"><span>Page name</span><input value={activePage.title} onChange={event => commit({ ...model, pages: pages.map(page => page.id === activePage.id ? { ...page, title: event.target.value } : page) })} /></label>{activePage.id !== pages[0].id && <><label className="property-field"><span>Page address</span><input value={activePage.slug} onChange={event => { const slug = pageSlug(event.target.value); if (pages.some(page => page.id !== activePage.id && page.slug === slug)) return showToast('This page address is already used'); commit({ ...model, pages: pages.map(page => page.id === activePage.id ? { ...page, slug } : page) }); }} /></label><button type="button" className="topbar-action" onClick={() => commit(reorderPage(model,activePage.id,-1))}>Move page up</button><button type="button" className="topbar-action" onClick={() => commit(reorderPage(model,activePage.id,1))}>Move page down</button></>}<label className="property-field"><span>Page title (SEO)</span><input value={activePage.seoTitle || ''} onChange={event => commit({ ...model, pages: pages.map(page => page.id === activePage.id ? { ...page, seoTitle: event.target.value } : page) })} /></label><label className="property-field"><span>Meta description</span><textarea value={activePage.description || ''} onChange={event => commit({ ...model, pages: pages.map(page => page.id === activePage.id ? { ...page, description: event.target.value } : page) })} /></label></>}
          {activeTab === "layers" && <><div className="side-heading"><span>Layers</span><p>Drag to reorder. Move buttons also work on touch devices.</p></div><div className="property-actions"><button type="button" onClick={() => { try { commit({...model,sections:groupSections(visibleSections,selectedLayers,createId('group'))});setSelectedLayers([]); } catch(error) {showToast(error.message);} }}>Group selected</button><button type="button" disabled={selected?.type !== 'group'} onClick={() => {try {commit({...model,sections:ungroupSections(visibleSections,selected.id)});}catch(error){showToast(error.message);}}}>Ungroup</button></div><div className="page-list">{visibleSections.map(section => <div key={section.id} draggable={!section.locked} onDragStart={() => setDraggedId(section.id)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); moveDraggedSection(section.id); }}><input type="checkbox" aria-label={`Select ${section.label} for grouping`} checked={selectedLayers.includes(section.id)} onChange={event=>setSelectedLayers(event.target.checked?[...selectedLayers,section.id]:selectedLayers.filter(id=>id!==section.id))}/><button type="button" onClick={() => setSelectedId(section.id)}>{section.label}<small>{section.title?.slice(0,35)} {section.locked ? '🔒' : ''}</small></button></div>)}</div><button className="topbar-action" type="button" disabled={!selected} onClick={() => { setCopiedSection(clone(selected)); showToast('Section copied'); }}>Copy</button><button className="topbar-action" type="button" disabled={!copiedSection} onClick={() => commit({ ...model, sections: [...visibleSections, { ...clone(copiedSection), id: createId(copiedSection.type) }] })}>Paste</button></>}
          {activeTab === "collections" && <><div className="side-heading"><span>Your reusable sections</span></div><button type="button" className="topbar-action" disabled={!selected} onClick={() => { const next = [...savedSections, { ...clone(selected), id: createId('saved') }]; commit({ ...model, savedSections: next }); }}>Save selected section</button><div className="page-list">{savedSections.map(section => <div key={section.id}><button type="button" onClick={() => commit({ ...model, sections: [...visibleSections, { ...clone(section), id: createId(section.type) }] })}>{section.title || section.label}</button></div>)}</div><div className="side-heading"><span>Design Collections</span><p>Mix original sections. Keep your own brand.</p></div><div className="collection-list">{DESIGN_COLLECTIONS.map(collection => <button type="button" key={collection.id} style={{ background: collection.paper, color: collection.ink }} onClick={() => setCollectionPreview(collection)}><small>{collection.category} / {collection.variant}</small><strong>{collection.title}</strong><span>{collection.name} ↗</span></button>)}</div></>}
          {activeTab === "sections" && <><div className="side-heading"><span>Add section</span><p>Build a complete business website.</p></div><div className="section-library">{SECTION_LIBRARY.map((item) => <button type="button" key={item.type} onClick={() => addSection(item.type)}><span className="library-thumbnail"><i /><i /><b /></span><span><strong>{item.label}</strong><small>{item.description}</small></span><em>＋</em></button>)}</div></>}
          {activeTab === "elements" && <><div className="side-heading"><span>Add element</span><p>Use these anywhere in your website.</p></div><div className="element-library">{ELEMENT_LIBRARY.map((item) => <button type="button" key={item.type} onClick={() => addSection(item.type)}><b>＋</b>{item.label}</button>)}</div></>}
          {activeTab === "products" && <><div className="side-heading"><span>Your products</span><p>Choose a real product to show on your website.</p></div><button type="button" className="add-real-product" onClick={() => setShowProductPicker(true)}>＋ Add product section</button><div className="side-product-list">{products.length ? products.map((product) => <button type="button" key={product.id} onClick={() => addProduct(product)}><span className="side-product-image" style={product.imageUrl || product.image ? { backgroundImage: `url(${product.imageUrl || product.image})` } : undefined} /><span><strong>{product.name}</strong><small>{money(product.sellingPrice)}</small></span><em>＋</em></button>) : <p className="empty-copy">No products yet. Add one from your Products page first.</p>}</div></>}
          {activeTab === "design" && <><div className="side-heading"><span>Brand kit</span><p>Set a consistent identity across every page.</p></div><label className="property-field"><span>Brand logo</span><input type="file" accept={IMAGE_ACCEPT} onChange={uploadLogo} disabled={uploadProgress !== null} /></label><label className="property-field"><span>Body font</span><select value={model.bodyFont || 'Arial'} onChange={event => updateModelField('bodyFont',event.target.value)}>{FONTS.map(font => <option key={font}>{font}</option>)}</select></label><label className="property-field"><span>Global heading font</span><select value={model.headingFont || 'Georgia'} onChange={event => { const font=event.target.value; const nextPages=pages.map(page=>({...page,sections:page.sections.map(section=>({...section,style:{...section.style,fontFamily:font}}))})); commit({...model,headingFont:font,pages:nextPages,sections:nextPages[0].sections}); }}>{FONTS.map(font => <option key={font}>{font}</option>)}</select></label><label className="property-field"><span>Button shape</span><select value={model.buttonRadius || '0'} onChange={event => updateModelField('buttonRadius',event.target.value)}><option value="0">Square</option><option value="6px">Soft</option><option value="40px">Pill</option></select></label><div className="side-heading"><span>Design</span><p>Set the base look of your website.</p></div><label className="design-field"><span>Primary colour</span><div className="colour-input"><input type="color" value={cleanColor(model.primaryColor)} onChange={(event) => updateGlobalColor("primaryColor", event.target.value)} /><input value={model.primaryColor} onChange={(event) => updateGlobalColor("primaryColor", event.target.value)} /></div></label><label className="design-field"><span>Background colour</span><div className="colour-input"><input type="color" value={cleanColor(model.backgroundColor, "#f7f2eb")} onChange={(event) => updateGlobalColor("backgroundColor", event.target.value)} /><input value={model.backgroundColor} onChange={(event) => updateGlobalColor("backgroundColor", event.target.value)} /></div></label><p className="recent-label">Recently used</p><div className="recent-colours">{model.recentColors.map((color) => <button key={color} type="button" aria-label={`Use ${color} as primary colour`} style={{ backgroundColor: color }} onClick={() => updateGlobalColor("primaryColor", color)} />)}</div><div className="design-note">These colors change your customer website. GETCYB keeps its beige, white and black workspace.</div></>}
        </div>
      </aside>
      <main className="editor-canvas-wrap"><div className="canvas-meta"><span><b>Live preview</b> · click a section to edit it</span><label>Zoom <select aria-label="Canvas zoom" value={zoom} onChange={event => setZoom(Number(event.target.value))}>{[50,75,100,125].map(value => <option key={value} value={value}>{value}%</option>)}</select> · {canvasSize}</label></div><div className={`website-canvas cyb-site cyb-device-${device} ${device}`} style={{ backgroundColor: model.backgroundColor, color: model.textColor, '--cyb-primary': model.primaryColor, '--cyb-button-radius': model.buttonRadius || '0', fontFamily: model.bodyFont || 'Arial', zoom: zoom / 100 }}><header className="cyb-nav"><span className="cyb-logo">{model.logo ? <img src={model.logo} alt={model.brandName} /> : model.brandName}</span><nav>{pages.map(page => <button type="button" key={page.id} onClick={() => choosePage(page)}>{page.title}</button>)}</nav></header>{visibleSections.map(section => renderSection(section))}</div><div className={`section-drop-zone${draggedId ? " active" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!draggedId) return; const moved = visibleSections.find((section) => section.id === draggedId); if (!moved || moved.locked) return; const next = [...visibleSections.filter((section) => section.id !== draggedId), moved]; commit({ ...model, sections: next }, { message: "Section moved to bottom" }); setDraggedId(null); }}>Drop a section here to move it to the bottom</div></main>
      <aside className="editor-properties-panel"><div className="properties-top"><span>Properties</span><small>{selected ? "Selected" : "Nothing selected"}</small></div>{propertiesPanel()}</aside>
    </div>
    {showProductPicker && <div className="editor-modal-backdrop" role="presentation" onMouseDown={() => setShowProductPicker(false)}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="product-picker-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setShowProductPicker(false)} aria-label="Close">×</button><p className="modal-kicker">Your products</p><h2 id="product-picker-title">What product do you want to add?</h2><p>Select a product that already exists in your GetCyb Products page.</p><div className="picker-products">{products.length ? products.map((product) => <button type="button" key={product.id} onClick={() => addProduct(product)}><span className="picker-product-image" style={product.imageUrl || product.image ? { backgroundImage: `url(${product.imageUrl || product.image})` } : undefined} /><span><strong>{product.name}</strong><small>{product.description || "No description yet"}</small></span><b>{money(product.sellingPrice)}</b></button>) : <div className="empty-picker">No products yet. Add a product from the Products page, then come back here.</div>}</div></section></div>}
    {showPreview && <div className="full-preview"><header><span>Preview · {activePage.title}</span><button type="button" onClick={() => setShowPreview(false)}>Back to editor</button></header><div className={`full-preview-site preview-device-${device}`}><WebsiteRenderer model={model} products={products} catalog={catalog} slug={activePage.slug} device={device} onPageChange={choosePage} /></div></div>}
    {collectionPreview && <div className="full-preview"><header><span>{collectionPreview.name} · Design Collection preview</span><div><button type="button" onClick={() => applyCollection(collectionPreview)}>Add sections to current page</button><button type="button" onClick={() => addCollectionPages(collectionPreview)}>Add all 4 pages</button><button type="button" onClick={() => setCollectionPreview(null)}>Close</button></div></header><WebsiteRenderer model={collectionWebsite(collectionPreview,createSection)} /></div>}
    {showPublishReview && <div className="editor-modal-backdrop"><section className="editor-modal publish-review" role="dialog" aria-modal="true" aria-labelledby="publish-review-title"><h2 id="publish-review-title">Ready to publish?</h2><p>Your latest draft will replace the public version. Review every page on Laptop, iPad and Phone first.</p>{publishWarnings(model).length > 0 && <ul>{publishWarnings(model).map((warning,index) => <li key={index}>{warning}</li>)}</ul>}<p>Booking, forms and checkout require their services to be configured. Preview does not submit transactions.</p><div className="property-actions"><button type="button" onClick={() => setShowPublishReview(false)}>Keep editing</button><button type="button" disabled={saving || uploadProgress !== null} onClick={publishWebsite}>{saving ? 'Publishing…' : 'Publish website'}</button></div></section></div>}
    {showPublish && <div className="editor-modal-backdrop" role="presentation"><section className="editor-modal publish-modal" role="dialog" aria-modal="true"><p className="modal-kicker">Published</p><h2>Your website is live.</h2><p>Your last design is now saved to your GetCyb store and will be shown on your public website.</p>{publishUrl ? <a href={publishUrl} target="_blank" rel="noreferrer">Open your website ↗</a> : <div className="publish-missing-url">Finish Store Setup to choose your public website address.</div>}<button className="topbar-action" type="button" onClick={() => setShowPublish(false)}>Done</button></section></div>}
    {toast && <div className="editor-toast" role="status">{toast}</div>}
  </div>;
}

function EditableSimpleItems({ items, label, onChange }) {
  function update(index, value) { onChange(items.map((item, itemIndex) => itemIndex === index ? value : item)); }
  function remove(index) { onChange(items.filter((_, itemIndex) => itemIndex !== index)); }
  return <div className="property-field"><span>{label}</span>{items.map((item, index) => <div className="repeater-row" key={index}><input value={item} onChange={(event) => update(index, event.target.value)} /><button type="button" onClick={() => remove(index)} aria-label="Remove">×</button></div>)}<button className="add-repeater" type="button" onClick={() => onChange([...items, "New item"])}>＋ Add item</button></div>;
}

function EditableMenuItems({ items, onChange }) {
  function update(index, patch) { onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  return <div className="property-field"><span>Menu items</span>{items.map((item, index) => <div className="menu-repeater" key={index}><input value={item.name} onChange={(event) => update(index, { name: event.target.value })} /><input value={item.price} onChange={(event) => update(index, { price: event.target.value })} /></div>)}<button className="add-repeater" type="button" onClick={() => onChange([...items, { name: "New item", price: "$0" }])}>＋ Add item</button></div>;
}

function EditableFaqItems({ items, onChange }) {
  function update(index, patch) { onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  return <div className="property-field"><span>Questions</span>{items.map((item, index) => <div className="faq-repeater" key={index}><input value={item.question} onChange={(event) => update(index, { question: event.target.value })} /><textarea rows="2" value={item.answer} onChange={(event) => update(index, { answer: event.target.value })} /></div>)}<button className="add-repeater" type="button" onClick={() => onChange([...items, { question: "New question", answer: "New answer" }])}>＋ Add question</button></div>;
}
