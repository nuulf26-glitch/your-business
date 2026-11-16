import { EDITOR_MODES, editorMode } from "../editor/editorState";
import { groupSections, ungroupSections, mediaAssets, findSection, updateNestedSection, reorderNestedSection, removeNestedSection, sectionSiblings, insertAfterSection } from "../editor/structure";
import { publishSnapshot, websiteVersions, loadWebsiteRecord, loadPublicationDiagnostic, saveWebsiteDraft, unpublishWebsite } from "../editor/versionService";
import { websitePublicationStatus } from "../editor/websiteStatus";
import WebsiteRenderer from "../editor/WebsiteRenderer";
import { websitePages, websiteNavigation, setNavigationItem, addExternalNavigation, addPageNavigation, reorderNavigation, removeNavigation, changePageSections, addWebsitePage, pageSlug, reorderPage, duplicateWebsitePage, setHomepage, deleteWebsitePage, cloneSectionWithNewIds } from "../editor/pages";
import { DESIGN_COLLECTIONS, collectionSections, collectionWebsite } from "../editor/collections";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStore } from "../services/storeService";
import { getProducts, updateProduct } from "../services/productService";
import { uploadProductImage } from "../services/imageService";
import { isSupportedImageFile } from "../media/uploadPolicy.js";
import AiDesigner from "../components/AiDesigner";
import EditorProductForm from '../components/EditorProductForm';
import MediaFields from '../media/MediaFields';
import { mediaItems, primaryImage } from '../media/media';
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
  { type: "cta", label: "Call to action", description: "Guide visitors to one clear next step" },
  { type: "about", label: "About", description: "Tell your story" },
  { type: "services", label: "Services", description: "Show what you offer" },
  { type: "menu", label: "Menu", description: "Restaurant items & prices" },
  { type: "booking", label: "Booking", description: "Appointments & classes" },
  { type: "collection", label: "Product collection", description: "Your published product catalogue" },
  { type: "gallery", label: "Gallery", description: "Show your work" },
  { type: "video", label: "Video", description: "Add a hosted video to your page" },
  { type: "container", label: "Container", description: "A nested area for related content" },
  { type: "columns", label: "Columns", description: "Arrange content in responsive columns" },
  { type: "reviews", label: "Customer reviews", description: "Add genuine customer quotes" },
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
  { type: "video", label: "Video" },
  { type: "container", label: "Container" },
  { type: "columns", label: "Columns" },
  { type: "cta", label: "Call to action" },
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
    cta: { ...common, label: "Call to action", title: "Ready to get started?", body: "Tell visitors what to do next.", buttonText: "Get in touch", href: "#contact", style: { ...common.style, fontSize: 40, color: "#171513", textAlign: "center" } },
    container: { ...common, label: "Container", title: "Container", children: [], style: { ...common.style, fontSize: 24, paddingY: 24, maxWidth: 960 } },
    columns: { ...common, label: "Columns", title: "Columns", children: [], columnCount: 2, style: { ...common.style, fontSize: 24, paddingY: 24 } },
    video: { ...common, label: "Video", title: "Video", body: "Upload a video from media controls.", media: [], alt: "" },
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
    reviews: { ...common, label: "Customer reviews", title: "Kind words from our customers", body: "Add quotes from real customers who have agreed to be featured.", items: [{ name: "Customer name", quote: "Add a real customer review here." }] },
    faq: {
      ...common, label: "FAQ", title: "Questions, answered.", body: "Give customers the confidence to take the next step.",
      items: [
        { question: "How do I book?", answer: "Choose the service you want, then send us your preferred time." },
        { question: "Where are you based?", answer: "Add your location and contact details here." },
      ], style: { ...common.style, fontSize: 34, color: "#171513" },
    },
    footer: {
      ...common, label: "Footer", title: "Made with care.", body: "Add your contact details, opening hours, or social links here.",
      style: { ...common.style, fontSize: 28, color: "#171513" },
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

function isImageFile(file) {
  return isSupportedImageFile(file);
}

export default function WebsiteEditor() {
  const [cacheKey] = useState(() => `websiteEditorData:${localStorage.getItem('getcyb_account_id') || 'custom'}`);
  const [mode, setMode] = useState(() => { try { return editorMode(localStorage.getItem(`${cacheKey}:mode`) || 'simple'); } catch { return 'simple'; } });
  const [mobilePanel, setMobilePanel] = useState('canvas');
  const [model, setModel] = useState(createDefaultModel);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadNotice, setLoadNotice] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [activePageId, setActivePageId] = useState("home");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [externalLinkLabel, setExternalLinkLabel] = useState("");
  const [externalLinkUrl, setExternalLinkUrl] = useState("");
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
  const [productForm,setProductForm]=useState(null);
  const [mediaUploading,setMediaUploading]=useState(false);
  const [productMediaSaving,setProductMediaSaving]=useState(0);
  const productMediaQueue=useRef(Promise.resolve());
  const [showPreview, setShowPreview] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showAiDesigner, setShowAiDesigner] = useState(false);
  const [publishUrl, setPublishUrl] = useState("");
  const [status, setStatus] = useState("Saved");
  const [publicationStatus, setPublicationStatus] = useState('Checking…');
  const [publicationDiagnostic, setPublicationDiagnostic] = useState(null);
  const [websiteRevision, setWebsiteRevision] = useState(null);
  const [saving, setSaving] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [draggedId, setDraggedId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const currentModel = useRef(model);
  const saveDraftRef = useRef(null);
  function switchMode(value) { const next=editorMode(value);setMode(next);try {localStorage.setItem(`${cacheKey}:mode`,next);}catch { /* Mode choice still applies if browser storage is unavailable. */ } if(next==='simple')setActiveTab('pages'); }

  const pages = websitePages(model);
  const activePage = pages.find(page => page.id === activePageId) || pages[0];
  const visibleSections = activePage.sections;
  const selected = findSection(visibleSections, selectedId);
  const canvasSize = { laptop: "Laptop · fluid", ipad: "iPad · up to 834 px", phone: "Phone · 390 px" }[device];

  useEffect(() => {
    let active = true;
    async function loadEditor() {
      try {
        setLoadNotice("");
        const [storeResult, productsResult, draftResult, diagnosticResult] = await Promise.allSettled([getStore(), getProducts(), loadWebsiteRecord(), loadPublicationDiagnostic()]);
        if (!active) return;
        if (diagnosticResult.status === 'fulfilled') setPublicationDiagnostic(diagnosticResult.value);
        let cached = null;
        try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch { /* Ignore corrupt recovery data. */ }
        const store = storeResult.status === 'fulfilled' ? storeResult.value : null;
        const draftFailed = draftResult.status === 'rejected';
        if (draftFailed) setPublicationStatus('Unavailable');
        if (draftFailed && !(cached?.dirty && cached?.model && window.confirm('The saved website could not be reached. Restore this device’s unsaved changes while you retry?'))) throw draftResult.reason;
        const websiteRecord = draftFailed ? null : draftResult.value;
        setWebsiteRevision(Number.isInteger(websiteRecord?.revision) ? websiteRecord.revision : null);
        const privateDraft = websiteRecord?.draft || null;
        if (!draftFailed) setPublicationStatus(websitePublicationStatus(websiteRecord));
        const productList = productsResult.status === "fulfilled" ? productsResult.value : [];
        if (draftFailed && cached?.dirty && cached?.model) {
          const next = migrateLegacyEditor(cached.model);
          setModel(next); setSavedSections(next.savedSections || []); setSelectedId(next.sections[0]?.id || null); setStatus('Unsaved');
          setLoadNotice(`Your saved website could not be loaded: ${draftResult.reason?.message || 'temporary connection error'}. Your device copy is open; retry before saving.`);
        } else if (privateDraft || store?.editorData || store?.sections || store?.elements) {
          let next = migrateLegacyEditor(privateDraft || store);
          let recovered = false;
          if (cached?.dirty && cached.model && window.confirm('Restore unsaved changes from this device?')) { next = migrateLegacyEditor(cached.model); recovered = true; }
          setModel(next);
          setSavedSections(next.savedSections || []);
          setSelectedId(next.sections[0]?.id || null);
          setStatus(recovered ? "Unsaved" : "Saved");
        } else {
          if (store?.businessName || store?.storeName) setModel(current => ({ ...current, brandName: store.businessName || store.storeName }));
          setSelectedId((current) => current || currentModel.current.sections[0]?.id || null);
        }
        setProducts(Array.isArray(productList) ? productList : []);
        if (productsResult.status === "rejected") {
          const reason = productsResult.reason;
          setLoadNotice(`Your website loaded, but products could not be loaded${reason?.message ? `: ${reason.message}` : "."}`);
        }
        if (storeResult.status === 'rejected' && !draftFailed) setLoadNotice(current => current || `Your website loaded, but business details could not be refreshed: ${storeResult.reason?.message || 'temporary connection error'}.`);
        setLoaded(true);
      } catch (error) {
        console.error("Could not load website editor data:", error);
        if (active) setLoadError(error?.message || "Could not load your website. Check your connection and try again.");
      }
    }
    loadEditor();
    return () => { active = false; };
  }, [loadAttempt, cacheKey]);

  useEffect(() => { if (loaded) {
    try { localStorage.setItem(cacheKey, JSON.stringify({ model, dirty: !['Saved','Published'].includes(status) })); }
    catch { /* Cloud saves remain available if device storage is full. */ }
  } }, [model, loaded, cacheKey, status]);
  useEffect(() => { currentModel.current = model; }, [model]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    const warn = event => { if(['Unsaved', 'Saving…', 'Save failed'].includes(status)) { event.preventDefault(); event.returnValue=''; } };
    window.addEventListener('beforeunload',warn);
    return () => window.removeEventListener('beforeunload',warn);
  },[status]);

  useEffect(() => {
    if (!loaded || saving || status !== 'Unsaved') return;
    const timer = setTimeout(() => saveDraftRef.current?.(),2000);
    return () => clearTimeout(timer);
  },[model,loaded,saving,status]);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }

  function commit(nextModel, options = {}) {
    if (nextModel.sections !== model.sections && nextModel.pages === model.pages) {
      nextModel = changePageSections(model, activePage.id, nextModel.sections);
    }
    const { recordHistory = true, message } = options;
    if (recordHistory) {
      // Capture before replacing the ref. React may run the state updater later,
      // after currentModel.current already points at nextModel.
      const previousModel = clone(currentModel.current);
      setUndoStack((previous) => [...previous, previousModel].slice(-60));
      setRedoStack([]);
    }
    currentModel.current = nextModel;
    setModel(nextModel);
    setSavedSections(nextModel.savedSections || []);
    setStatus("Unsaved");
    setPublicationStatus(current => current === 'Published' || current === 'Unpublished changes' ? 'Unpublished changes' : current === 'Checking…' ? current : 'Draft');
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
    commit({ ...model, sections: ['group','container','columns'].includes(selected?.type) ? updateNestedSection(visibleSections, selected.id, group => ({ ...group, children: [...(group.children || []), section] })) : [...visibleSections, section] }, { message: `${section.label} added` });
    setSelectedId(section.id);
  }
  function addProduct(product) {
    const section = createSection("product", product);
    commit({ ...model, sections: ['group','container','columns'].includes(selected?.type) ? updateNestedSection(visibleSections, selected.id, group => ({ ...group, children: [...(group.children || []), section] })) : [...visibleSections, section] }, { message: "Product added" });
    setSelectedId(section.id);
    setShowProductPicker(false);
  }
  function updateSection(patch) {
    if (!selected || selected.locked) return;
    commit({ ...model, sections: updateNestedSection(visibleSections, selected.id, section => ({ ...section, ...patch })) });
  }
  function updateSectionStyle(patch) {
    if (!selected) return;
    if (device === 'laptop') updateSection({ style: { ...selected.style, ...patch } });
    else updateSection({ responsive: { ...selected.responsive, [device]: { ...selected.responsive?.[device], ...patch } } });
  }
  function updateSectionColor(color) {
    if (!selected || selected.locked) return;
    const normalized = cleanColor(color, selected.style?.color || "#171513");
    commit({ ...model, recentColors: addRecentColor(normalized), sections: updateNestedSection(visibleSections, selected.id, section => ({ ...section, style: { ...section.style, color: normalized } })) });
  }
  function duplicateSelected() {
    if (!selected) return;
    const copy = { ...cloneSectionWithNewIds(selected, prefix => createId(prefix)), title: selected.title ? `${selected.title} (copy)` : "Copy" };
    const inserted=insertAfterSection(visibleSections,selected.id,copy);
    commit({ ...model, sections: inserted }, { message: "Section duplicated" }); setSelectedId(copy.id);
  }
  function moveSelected(direction) {
    if (!selected || selected.locked) return;
    const siblings=sectionSiblings(visibleSections,selected.id) || visibleSections;const currentIndex=siblings.findIndex(section=>section.id===selected.id);const target=siblings[currentIndex+direction];
    if(!target)return;
    const next=reorderNestedSection(visibleSections,selected.id,target.id,direction<0?'before':'after');
    commit({ ...model, sections: next }, { message: "Section moved" });
  }
  function deleteSelected() {
    if (!selected || selected.locked) return;
    const siblings=sectionSiblings(visibleSections,selected.id) || visibleSections;
    if (siblings.length === 1 && siblings === visibleSections) { showToast("Keep at least one section on the page"); return; }
    const index = siblings.findIndex((section) => section.id === selected.id);
    const nextSelection=siblings.filter(section=>section.id!==selected.id)[Math.max(0,index-1)] || siblings.find(section=>section.id!==selected.id);
    const next = removeNestedSection(visibleSections, selected.id);
    commit({ ...model, sections: next }, { message: "Section deleted" });
    setSelectedId(nextSelection?.id || next[0]?.id || null);
  }
  function moveDraggedSection(targetId, position = "before") {
    if (!draggedId || draggedId === targetId) return;
    const dragged = findSection(visibleSections,draggedId); if (!dragged || dragged.locked) return;
    const next = reorderNestedSection(visibleSections,draggedId,targetId,position);
    if(next===visibleSections)return;
    commit({ ...model, sections: next }, { message: "Section moved" }); setDraggedId(null); setDropTarget(null);
  }
  async function uploadImage(event, slot = "image", sectionId = selected?.id) {
    const file = event.target.files?.[0];
    const galleryIndex = Number(event.target.dataset.index || 0);
    event.target.value = "";
    if (!file || !sectionId) return;
    if (!isImageFile(file)) { showToast("Choose a JPG, PNG, WEBP or GIF image up to 20 MB."); return; }
    setStatus("Uploading image…");
    try {
      const url = await uploadProductImage(file,{onProgress:state=>setStatus(state.phase==='verifying'?'Checking image…':`Uploading image ${state.percent}%`)});
      const latest = currentModel.current;
      const targetPage = websitePages(latest).find(page => findSection(page.sections,sectionId));
      if (!targetPage) return;
      const sections = updateNestedSection(targetPage.sections,sectionId,item=>{
        if (item.locked) return item;
        if (slot === 'gallery') {
          const images = [...(item.images || [])]; images[galleryIndex] = url;
          return {...item,images,media:images.filter(Boolean).map((image,index)=>({id:`gallery-${index}`,type:'image',url:image,width:100,unit:'%',fit:'cover'}))};
        }
        const media = mediaItems(item), first = media.findIndex(entry=>entry.type==='image');
        if (first >= 0) media[first] = {...media[first],url};
        else media.push({id:crypto.randomUUID(),type:'image',url,width:100,unit:'%',height:'',fit:'cover'});
        return {...item,image:url,media};
      });
      commit(changePageSections(latest,targetPage.id,sections));
      setStatus("Unsaved"); showToast("Image updated");
    } catch (error) {
      console.error("Image upload failed:", error); setStatus("Image upload failed"); showToast(error?.message || "Image upload failed. Check your connection and try again.");
    }
  }
  const undo = useCallback(() => {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((items) => items.slice(0, -1)); setRedoStack((items) => [clone(model), ...items].slice(0, 60)); setModel(previous);
    const page=websitePages(previous).find(item=>item.id===activePageId)||websitePages(previous)[0];
    currentModel.current = previous; setSavedSections(previous.savedSections || []); setActivePageId(page.id); setSelectedId(findSection(page.sections,selectedId)?selectedId:page.sections[0]?.id||null); setStatus("Unsaved"); setPublicationStatus(current => current === 'Published' ? 'Unpublished changes' : current);
  }, [undoStack, model, activePageId, selectedId]);
  const redo = useCallback(() => {
    if (!redoStack.length) return;
    const next = redoStack[0]; setRedoStack((items) => items.slice(1)); setUndoStack((items) => [...items, clone(model)].slice(-60)); setModel(next);
    const page=websitePages(next).find(item=>item.id===activePageId)||websitePages(next)[0];
    currentModel.current = next; setSavedSections(next.savedSections || []); setActivePageId(page.id); setSelectedId(findSection(page.sections,selectedId)?selectedId:page.sections[0]?.id||null); setStatus("Unsaved"); setPublicationStatus(current => current === 'Published' ? 'Unpublished changes' : current);
  }, [redoStack, model, activePageId, selectedId]);
  useEffect(() => {
    const onKeyDown = event => {
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target.tagName));
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key.toLowerCase() === 's') { event.preventDefault(); if (!saving && !mediaUploading && !productMediaSaving) saveDraftRef.current?.(); return; }
      if (typing) return;
      if (event.key.toLowerCase() === 'z' && event.shiftKey) { event.preventDefault(); redo(); }
      else if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
      else if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, undoStack, redoStack, model, saving, mediaUploading, productMediaSaving]);
  function editorPayload() {
    return { ...model, editorVersion: 2, elements: model.sections, sections: model.sections, updatedAt: new Date().toISOString() };
  }
  async function saveDraft() {
    setSaving(true); setStatus("Saving…");
    try {
      const source = model; const payload = editorPayload();
      const result = await saveWebsiteDraft(payload,websiteRevision ?? undefined);
      if(Number.isInteger(result?.revision))setWebsiteRevision(result.revision);
      if (currentModel.current === source) { setStatus("Saved"); showToast("Draft saved"); } else { setStatus("Unsaved"); showToast("Draft snapshot saved. Newer edits still need saving."); }
    } catch (error) {
      console.error("Could not save website editor:", error); setStatus("Save failed"); showToast(error.message || "Could not save your draft");
    } finally { setSaving(false); }
  }
  useEffect(() => { saveDraftRef.current = saveDraft; });
  async function publishWebsite() {
    setSaving(true); setStatus("Publishing…");
    try {
      const source = model; const payload = editorPayload();
      const result = await publishSnapshot(payload,websiteRevision ?? undefined);
      if (!result?.slug) throw new Error("The website was saved, but the server did not return its public address. Refresh and check the website status before trying again.");
      if(Number.isInteger(result.revision))setWebsiteRevision(result.revision);
      setPublishUrl(`${window.location.origin}/store/${result.slug}`);
      if (currentModel.current === source) { setStatus("Published"); setPublicationStatus('Published'); setShowPublish(true); }
      else { setStatus('Unsaved'); setPublicationStatus('Unpublished changes'); showToast('The captured version was published. Newer edits remain an unpublished draft.'); }
    } catch (error) {
      console.error("Could not publish website:", error); setStatus("Publish failed"); showToast(error.message || "Could not publish your website");
    } finally { setSaving(false); }
  }

  function editText(id, field, value) {
    const original = findSection(visibleSections,id);
    if (original?.locked || original?.[field] === value) return;
    commit({ ...model, sections: updateNestedSection(visibleSections,id,section=>({...section,[field]:value})) });
  }
  function handleNestedDrop(action,id,position) {
    if(action==='over'){if(draggedId && draggedId!==id && sectionSiblings(visibleSections,draggedId)===sectionSiblings(visibleSections,id))setDropTarget({id,position});else setDropTarget(null);return;}
    if(action==='leave'){if(dropTarget?.id===id)setDropTarget(null);return;}
    if(action==='drop')moveDraggedSection(id,dropTarget?.id===id?dropTarget.position:'before');
  }
  function renderSection({ section, content, style }) {
    const editable = !section.locked;
    const isDropTarget = dropTarget?.id === section.id;
    return <section key={section.id} id={section.anchor || section.id} className={`cyb-section cyb-type-${section.type} editor-section ${selectedId === section.id ? 'selected' : ''} ${isDropTarget ? `drop-${dropTarget.position}` : ''}`} style={style} onClick={event => {
      if (event.target.closest("a")) event.preventDefault();
      setSelectedId(section.id);
      if (section.locked || !["hero", "about", "photo"].includes(section.type)) return;
      const heroImageArea = section.type === "hero" && event.target.closest(".cyb-hero") && !event.target.closest(".cyb-hero-copy");
      const aboutImageArea = section.type === "about" && (event.target.closest(".cyb-about .cyb-image") || (event.target.classList?.contains("cyb-about") && event.nativeEvent.offsetX < event.currentTarget.clientWidth / 2));
      const photoImageArea = section.type === "photo" && event.target.closest(".cyb-image");
      if (heroImageArea || aboutImageArea || photoImageArea) event.currentTarget.querySelector('input[data-cyb-image-upload]')?.click();
    }} onDragOver={event => { event.preventDefault(); if (!draggedId || draggedId === section.id || section.locked || sectionSiblings(visibleSections,draggedId)!==sectionSiblings(visibleSections,section.id)) { setDropTarget(null); return; } const rect = event.currentTarget.getBoundingClientRect(); setDropTarget({ id: section.id, position: event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before' }); }} onDragLeave={() => { if (dropTarget?.id === section.id) setDropTarget(null); }} onDrop={event => { event.preventDefault(); moveDraggedSection(section.id, dropTarget?.id === section.id ? dropTarget.position : 'before'); }}>
      <div className="editor-section-label"><span>{section.layerName || section.label} {section.locked ? '· Locked' : ''}</span>{editable && <button type="button" draggable aria-label={`Move ${section.label}`} onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', section.id); setDraggedId(section.id); }} onDragEnd={() => { setDraggedId(null); setDropTarget(null); }}>⠿</button>}</div>
      {content}
      {["hero", "about", "photo"].includes(section.type) && !section.locked && <input data-cyb-image-upload type="file" accept="image/*" aria-label={`Upload image for ${section.label}`} style={{ display: "none" }} onChange={event => uploadImage(event, "image", section.id)} />}
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
    const prefix = `${collection.id}-${crypto.randomUUID()}`;
    const incoming = template.pages.map(page => ({ ...page, id: `${prefix}-${page.id}`, slug: `${prefix}${page.slug ? `-${page.slug}` : ''}`, title: `${collection.name} · ${page.title}` }));
    commit({ ...model,pages:[...pages,...incoming] },{message:'Four collection pages added. Rename their addresses in Pages.'});
    choosePage(incoming[0]);setCollectionPreview(null);
  }
  function duplicatePage(page) {
    try { const existing = new Set(pages.map(item => item.id)); const next = duplicateWebsitePage(model, page.id, prefix => createId(prefix)); const copy = next.pages.find(item => !existing.has(item.id)); commit(next, { message: `${page.title} duplicated` }); choosePage(copy); }
    catch (error) { showToast(error.message); }
  }
  function makeHomepage(page) {
    try { const next = setHomepage(model, page.id); commit(next, { message: `${page.title} is now your homepage` }); choosePage(next.pages[0]); }
    catch (error) { showToast(error.message); }
  }
  function renderLayer(section, depth = 0) {
    return <div className="editor-layer-node" key={section.id} style={{ marginLeft: depth ? 14 : 0 }}>
      <div className={`editor-layer-row ${selectedId===section.id?'active':''}`} draggable={!section.locked} onDragStart={event=>{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',section.id);setDraggedId(section.id);}} onDragOver={event=>{event.preventDefault();if(!draggedId||draggedId===section.id)return;const rect=event.currentTarget.getBoundingClientRect();setDropTarget({id:section.id,position:event.clientY>=rect.top+rect.height/2?'after':'before'});}} onDrop={event=>{event.preventDefault();moveDraggedSection(section.id,dropTarget?.id===section.id?dropTarget.position:'before');}} onDragEnd={()=>{setDraggedId(null);setDropTarget(null);}}>
        {depth===0&&<input type="checkbox" aria-label={`Select ${section.layerName||section.label} for grouping`} checked={selectedLayers.includes(section.id)} onChange={event=>setSelectedLayers(event.target.checked?[...selectedLayers,section.id]:selectedLayers.filter(id=>id!==section.id))}/>}
        <button type="button" className="editor-layer-select" aria-current={selectedId===section.id?'true':undefined} onClick={()=>setSelectedId(section.id)}>{section.layerName||section.label||section.type}</button>
        <button type="button" className="editor-layer-visibility" aria-label={`${section.style?.hidden?'Show':'Hide'} ${section.layerName||section.label||section.type}`} onClick={()=>commit({...model,sections:updateNestedSection(visibleSections,section.id,current=>({...current,style:{...current.style,hidden:!current.style?.hidden}}))})}>{section.style?.hidden?'◉':'◌'}</button>
      </div>
      {Array.isArray(section.children)&&section.children.map(child=>renderLayer(child,depth+1))}
    </div>;
  }
  function propertiesPanel() {
    if (!selected) return <div className="property-empty">Select any section in your website to change its content, type, colour, or position.</div>;
    const supportsTitle = selected.type !== "text";
    const supportsBody = !["heading", "button"].includes(selected.type);
    const supportsButton = ["hero", "about", "booking", "button"].includes(selected.type);
    const supportsImage = true;
    const selectedProduct=selected.type==='product'?products.find(item=>item.id===selected.productId||item.legacyId===selected.productId):null;
    const displayStyle = { ...selected.style, ...selected.responsive?.[device] };
    return <>
      <button type="button" className="topbar-action" onClick={() => commit({ ...model, sections: visibleSections.map(item => item.id === selected.id ? { ...item, locked: !item.locked } : item) })}>{selected.locked ? "Unlock section" : "Lock section"}</button>
      <h2 className="selected-heading">{selected.layerName || selected.label}</h2><p className="selected-caption">Editing the selected section</p>
      {mode === 'professional' && <label className="property-field"><span>Layer name</span><input value={selected.layerName || selected.label || selected.type} maxLength={80} onChange={event => updateSection({ layerName: event.target.value })} /></label>}
      {['group','container','columns'].includes(selected.type) && <>{selected.type==='columns'&&<label className="property-field"><span>Number of columns</span><select value={selected.columnCount||2} onChange={event=>updateSection({columnCount:Number(event.target.value)})}>{[1,2,3,4].map(count=><option key={count} value={count}>{count}</option>)}</select></label>}<p className="selected-caption">{selected.children?.length ? `${selected.children.length} nested item${selected.children.length===1?'':'s'}` : 'This layout is empty.'}</p><button type="button" className="topbar-action" onClick={()=>setActiveTab('elements')}>Add an element inside</button></>}
      {supportsTitle && <label className="property-field"><span>Heading</span><input value={selected.title || ""} onChange={(event) => updateSection({ title: event.target.value })} /></label>}
      {supportsBody && <label className="property-field"><span>{selected.type === "chat" ? "Message" : "Description"}</span><textarea rows="4" value={selected.body || ""} onChange={(event) => updateSection({ body: event.target.value })} /></label>}
      {supportsButton && <label className="property-field"><span>Button destination</span><input value={selected.href || ""} placeholder="https://… or #section-id" onChange={event => updateSection({ href: event.target.value })} /></label>}
      {supportsImage && <label className="property-field"><span>Image description (alt text)</span><input value={selected.alt || ""} onChange={event => updateSection({ alt: event.target.value })} /></label>}
      {supportsButton && <label className="property-field"><span>Button text</span><input value={selected.buttonText || ""} onChange={(event) => updateSection({ buttonText: event.target.value })} /></label>}
      {selected.type === "product" && <label className="property-field"><span>Price (USD)</span><input value={selected.price ?? ""} onChange={(event) => updateSection({ price: event.target.value })} /></label>}
      {selected.type === "chat" && <label className="property-field"><span>Business email</span><input type="email" value={selected.email || ""} onChange={(event) => updateSection({ email: event.target.value })} placeholder="hello@yourbusiness.com" /></label>}
      {selected.type === "reviews" && <EditableReviewItems items={selected.items || []} onChange={items => updateSection({ items })} />}
      <MediaFields key={selected.id} items={mediaItems(selectedProduct || selected)} onBusyChange={setMediaUploading} disabled={selected.locked} onChange={async media=>{if(selectedProduct){const updated={...selectedProduct,media,imageUrl:primaryImage(media)};setProducts(current=>current.map(item=>item.id===updated.id?updated:item));setProductMediaSaving(count=>count+1);const save=productMediaQueue.current.catch(()=>{}).then(()=>updateProduct(updated.id,updated));productMediaQueue.current=save;try{await save;}catch(error){showToast('Product media was not saved: '+error.message);throw error;}finally{setProductMediaSaving(count=>count-1);}return;}updateSection({media,image:primaryImage(media),images:media.filter(item=>item.type==='image').map(item=>item.url)});}}/>
      {['product','collection'].includes(selected.type) && <button type="button" className="add-repeater" onClick={()=>setProductForm({product:null,insert:selected.type==='product'?'replace':'none'})}>＋ Create product here</button>}
      {selected.type==='product' && <button type="button" className="add-repeater" onClick={()=>{const product=products.find(item=>item.id===selected.productId||item.legacyId===selected.productId);if(product)setProductForm({product,insert:'replace'});else setShowProductPicker(true);}}>Edit product details & media</button>}
      {['services','menu','gallery'].includes(selected.type) && <label className="property-field"><span>Content source</span><select value={selected.dataSource || 'custom'} onChange={event => updateSection({ dataSource: event.target.value })}><option value="custom">Custom section content</option><option value="catalog">Business workspace</option></select></label>}
      {selected.type === "services" && <EditableSimpleItems items={selected.items || []} label="Services" onChange={(items) => updateSection({ items })} />}
      {selected.type === "menu" && <EditableMenuItems items={selected.items || []} onChange={(items) => updateSection({ items })} />}
      {selected.type === "faq" && <EditableFaqItems items={selected.items || []} onChange={(items) => updateSection({ items })} />}
      {mode !== 'simple' && <details className="editor-design-settings" key={mode} open={mode === 'professional'}><summary>Design & responsive settings</summary>
      <p className="selected-caption">Layout overrides: {device === 'laptop' ? 'Base / Laptop' : device === 'ipad' ? 'iPad' : 'Phone'}</p>
      <label className="property-field"><span>Maximum width (px)</span><input type="number" min="280" max="2400" value={displayStyle.maxWidth || ''} placeholder="Full width" onChange={event=>updateSectionStyle({maxWidth:event.target.value ? Math.max(280,Math.min(2400,Number(event.target.value))):null})}/></label><label className="property-field"><span>Minimum height (px)</span><input type="number" min="0" max="1600" value={displayStyle.minHeight || ''} onChange={event=>updateSectionStyle({minHeight:Math.max(0,Math.min(1600,Number(event.target.value)))})}/></label>
      <label className="property-field"><span>Letter spacing (em)</span><input type="number" step="0.01" min="-0.1" max="1" value={selected.responsive?.[device]?.letterSpacing ?? selected.style?.letterSpacing ?? 0} onChange={event => updateSectionStyle({ letterSpacing: Math.min(1,Math.max(-0.1,Number(event.target.value))) })} /></label>
      <label className="property-field"><span>Line height</span><input type="number" step="0.05" min="0.8" max="3" value={selected.responsive?.[device]?.lineHeight ?? selected.style?.lineHeight ?? 1.05} onChange={event => updateSectionStyle({ lineHeight: Math.min(3,Math.max(0.8,Number(event.target.value))) })} /></label>
      <label className="property-field"><span>Section anchor</span><input value={selected.anchor || selected.id} onChange={event => updateSection({ anchor: pageSlug(event.target.value) })} /></label>
      <label className="property-field"><span>Visibility on this device</span><select value={selected.responsive?.[device]?.hidden ? 'hidden' : 'visible'} onChange={event => updateSection({ responsive: { ...selected.responsive, [device]: { ...selected.responsive?.[device], hidden: event.target.value === 'hidden' } } })}><option value="visible">Visible</option><option value="hidden">Hidden</option></select></label>
      <label className="property-field"><span>Alignment</span><select value={displayStyle.textAlign || "left"} onChange={event => updateSectionStyle({ textAlign: event.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></label>
      <div className="property-row"><label className="property-field"><span><input type="checkbox" checked={!!displayStyle.italic} onChange={event=>updateSectionStyle({italic:event.target.checked})}/> Italic</span></label><label className="property-field"><span><input type="checkbox" checked={!!displayStyle.underline} onChange={event=>updateSectionStyle({underline:event.target.checked})}/> Underline</span></label></div>
      <label className="property-field"><span>Vertical padding (px)</span><input type="number" min="0" max="240" value={displayStyle.paddingY ?? 64} onChange={event => updateSectionStyle({ paddingY: Math.min(240, Math.max(0, Number(event.target.value))) })} /></label>
      <label className="property-field"><span>Horizontal padding (px)</span><input type="number" min="0" max="300" value={displayStyle.paddingX ?? 0} onChange={event=>updateSectionStyle({paddingX:Math.min(300,Math.max(0,Number(event.target.value)||0))})}/></label>
      <div className="property-row"><label className="property-field"><span>Width (%)</span><input type="number" min="1" max="100" value={displayStyle.width ?? 100} onChange={event=>updateSectionStyle({width:Math.min(100,Math.max(1,Number(event.target.value)||100))})}/></label><label className="property-field"><span>Margin Y (px)</span><input type="number" min="-200" max="300" value={displayStyle.marginY ?? 0} onChange={event=>updateSectionStyle({marginY:Math.min(300,Math.max(-200,Number(event.target.value)||0))})}/></label></div>
      <div className="property-row"><label className="property-field"><span>Font weight</span><select value={displayStyle.fontWeight||400} onChange={event=>updateSectionStyle({fontWeight:Number(event.target.value)})}>{[300,400,500,600,700,800].map(weight=><option key={weight} value={weight}>{weight}</option>)}</select></label><label className="property-field"><span>Border radius (px)</span><input type="number" min="0" max="200" value={displayStyle.borderRadius??0} onChange={event=>updateSectionStyle({borderRadius:Math.min(200,Math.max(0,Number(event.target.value)||0))})}/></label></div>
      <div className="property-row"><label className="property-field"><span>Border width (px)</span><input type="number" min="0" max="20" value={displayStyle.borderWidth??0} onChange={event=>updateSectionStyle({borderWidth:Math.min(20,Math.max(0,Number(event.target.value)||0))})}/></label><label className="property-field"><span>Border color</span><input type="color" value={cleanColor(displayStyle.borderColor,'#d8d1c6')} onChange={event=>updateSectionStyle({borderColor:event.target.value})}/></label></div>
      <div className="property-row"><label className="property-field"><span>Shadow</span><select value={displayStyle.shadow||'none'} onChange={event=>updateSectionStyle({shadow:event.target.value})}><option value="none">None</option><option value="soft">Soft</option><option value="medium">Medium</option><option value="strong">Strong</option></select></label><label className="property-field"><span>Opacity</span><input type="number" min="0" max="1" step="0.05" value={displayStyle.opacity??1} onChange={event=>updateSectionStyle({opacity:Math.min(1,Math.max(0,Number(event.target.value)||0))})}/></label></div>
      <label className="property-field"><span>Section background</span><input type="color" value={displayStyle.backgroundColor || model.backgroundColor} onChange={event => updateSectionStyle({ backgroundColor: event.target.value })} /></label>
      <label className="property-field"><span>Background image URL</span><input type="url" value={displayStyle.backgroundImage||''} placeholder="https://…" onChange={event=>{const value=event.target.value.trim();if(value&&!/^https:\/\//i.test(value)&&!/^\/api\/v1\/uploads\/[a-zA-Z0-9_/-]+$/.test(value))return showToast('Use a secure HTTPS image URL or an uploaded CYB image.');updateSectionStyle({backgroundImage:value||null});}}/></label>

      <div className="property-row"><label className="property-field"><span>Font</span><select value={displayStyle.fontFamily || "Arial"} onChange={(event) => updateSectionStyle({ fontFamily: event.target.value })}>{FONTS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label><label className="property-field"><span>Title size</span><div className="range-input"><input type="range" min="12" max="76" value={displayStyle.fontSize || 16} onChange={(event) => updateSectionStyle({ fontSize: Number(event.target.value) })} /><output>{displayStyle.fontSize || 16}</output></div></label></div>
      <label className="property-field"><span>Text colour</span><div className="colour-input"><input type="color" value={cleanColor(selected.style?.color, "#171513")} onChange={(event) => updateSectionColor(event.target.value)} /><input value={selected.style?.color || "#171513"} onChange={(event) => updateSectionColor(event.target.value)} /></div></label>
      <p className="recent-label">Recently used</p><div className="recent-colours">{model.recentColors.map((color) => <button key={color} type="button" title={color} aria-label={`Use ${color}`} className={color.toLowerCase() === (selected.style?.color || "").toLowerCase() ? "active" : ""} style={{ backgroundColor: color }} onClick={() => updateSectionColor(color)} />)}</div>
      </details>}
      <div className="property-actions"><button type="button" onClick={() => moveSelected(-1)}>Move up</button><button type="button" onClick={() => moveSelected(1)}>Move down</button><button type="button" onClick={duplicateSelected}>Duplicate</button><button type="button" className="danger" onClick={deleteSelected}>Delete</button></div>
    </>;
  }

  if (!loaded) return <main role="status" style={{ padding: 40 }}>
    {loadError ? <><p role="alert">Could not load your website: {loadError}</p><button type="button" onClick={() => { setLoadError(""); setLoadAttempt(attempt => attempt + 1); }}>Try again</button></> : "Loading your website…"}
  </main>;

  return <div className={`getcyb-editor editor-mode-${mode} editor-mobile-${mobilePanel}`}>
    <header className="getcyb-editor-topbar">
      <a className="editor-back-dashboard" href="/dashboard">← Dashboard</a>
      <div className="editor-brand"><span className="editor-brand-mark">C</span><strong>CYB</strong></div>
      <div className="editor-project"><input aria-label="Business name" value={model.brandName} onChange={(event) => updateModelField("brandName", event.target.value || "Your Business")} /><span className="save-state saved">{publicationStatus}</span>{publicationDiagnostic?.changedPathCount > 0 && <details className="publication-diagnostic"><summary>Inspect {publicationDiagnostic.changedPathCount} saved difference{publicationDiagnostic.changedPathCount===1?'':'s'}</summary><p>Field paths only; website content is not included.</p><ul>{publicationDiagnostic.changedPaths.map((path,index)=><li key={`${path}-${index}`}><code>{path}</code></li>)}</ul>{publicationDiagnostic.truncated&&<p>Additional paths omitted.</p>}</details>}<span className={`save-state ${status === "Saved" || status === "Published" ? "saved" : ""}`}>{status}</span></div>
      <label className="editor-page-picker"><span>Page</span><select aria-label="Current page" value={activePage.id} onChange={event => { const page = pages.find(item => item.id === event.target.value); if (page) choosePage(page); }}>{pages.map(page => <option key={page.id} value={page.id}>{page.title}</option>)}</select></label>
      <div className="topbar-spacer" />
      <label className="editor-mode-picker"><span>Editing mode</span><select aria-label="Editing mode" value={mode} onChange={event => switchMode(event.target.value)}>{EDITOR_MODES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="history-controls"><button type="button" onClick={undo} disabled={!undoStack.length} aria-label="Undo">↶</button><button type="button" onClick={redo} disabled={!redoStack.length} aria-label="Redo">↷</button></div>
      <div className="device-controls" aria-label="Preview size">{[["laptop", "▣", "Desktop"], ["ipad", "▤", "Tablet"], ["phone", "▯", "Mobile"]].map(([id, icon, label]) => <button type="button" key={id} className={device === id ? "active" : ""} aria-pressed={device === id} aria-label={`${label} preview`} onClick={() => setDevice(id)}>{icon}<span>{label}</span></button>)}</div>
      <button className="topbar-action ai-launch" type="button" onClick={() => setShowAiDesigner(true)}>✦ Design with AI</button><button className="topbar-action" type="button" onClick={saveDraft} disabled={saving || mediaUploading || productMediaSaving>0}>Save Draft</button><button className="topbar-action" type="button" onClick={() => setShowPreview(true)}>Preview Website</button><button className="topbar-action primary" type="button" onClick={publishWebsite} disabled={saving || mediaUploading || productMediaSaving>0}>Publish</button>
    </header>
    {loadNotice && <p role="status" style={{ margin: "8px 16px", padding: "10px 14px", borderRadius: 8, background: "#f7f2eb", color: "#4b4035" }}>{loadNotice} <button type="button" onClick={() => setLoadAttempt(attempt => attempt + 1)}>Retry loading</button></p>}
    <nav className="editor-mobile-controls" aria-label="Editor workspace">{[['tools','Add & pages'],['canvas','Website'],['properties','Edit selected']].map(([id,label]) => <button type="button" key={id} aria-pressed={mobilePanel === id} onClick={() => setMobilePanel(id)}>{label}</button>)}</nav>
    <div className="editor-mode-hint">{EDITOR_MODES.find(item => item.id === mode).description} <span>Switch modes anytime. Your design stays the same.</span></div>
    <div className="getcyb-editor-workspace">
      <aside className="editor-left-panel">
        <nav className="editor-navigation" aria-label="Editor navigation">{[['pages','Pages','▤'],['sections','Add section','＋'],...(mode === 'simple' ? [] : [['design','Brand & design','◐']]),['assets','Media','▧'],...(mode === 'professional' ? [['layers','Layers','☷']] : [])].map(([id,label,icon]) => <button type="button" key={id} className={activeTab===id?'active':''} onClick={() => setActiveTab(id)}><span aria-hidden="true">{icon}</span>{label}</button>)}
        <details className="editor-more-tools"><summary>More tools</summary>{[['elements','Elements'],['products','Products'],['collections','Templates & reusable sections'],['history','Published versions'],['layers','Layers'],['design','Brand & design']].map(([id,label]) => <button type="button" key={id} onClick={() => setActiveTab(id)}>{label}</button>)}</details></nav>
        <div className="editor-side-content">
          {activeTab === "assets" && <><div className="side-heading"><span>Media library</span><p>Images already used in this website. Select a photo section, then choose an image.</p></div><div className="editor-assets">{mediaAssets(model).map(url => <button type="button" key={url} onClick={() => selected ? updateSection({image:url}) : showToast('Select a section first')}><img src={url} alt="Website asset" loading="lazy" /></button>)}</div>{!mediaAssets(model).length && <p className="empty-copy">Upload your first image from section properties or Brand Kit.</p>}</>}
          {activeTab === "history" && <><div className="side-heading"><span>Published versions</span><p>Restore a version as a draft. Publish separately when ready.</p></div><button type="button" className="topbar-action" onClick={async () => { try { setVersions(await websiteVersions()); } catch(error) { showToast(error.message); } }}>Load latest 10 versions</button><div className="page-list">{versions.map(version => <div key={version.id}><button type="button" onClick={() => { commit(migrateLegacyEditor(version.model)); setActivePageId(websitePages(version.model)[0].id); showToast('Version restored as draft'); }}>{new Date(version.publishedAt).toLocaleString()}</button></div>)}</div><button type="button" className="topbar-action" disabled={saving} onClick={async () => { if (!window.confirm('Unpublish this website? Your saved content stays available.')) return; setSaving(true); try { await unpublishWebsite(); setPublicationStatus('Draft'); showToast('Website unpublished'); } catch(error) { showToast(error.message); } finally { setSaving(false); } }}>Unpublish website</button></>}
          {activeTab === "pages" && <><div className="side-heading"><span>Website pages</span><p>Renamed pages keep their links. Deleted pages are removed from navigation.</p></div><div className="page-list">{pages.map((page, index) => <div key={page.id}><button type="button" className={activePage.id === page.id ? 'active' : ''} onClick={() => choosePage(page)}>{page.title}<small>{index === 0 ? 'Homepage · /' : `/${page.slug}`}</small></button><details className="page-actions"><summary aria-label={`${page.title} actions`}>⋯</summary><button type="button" onClick={() => duplicatePage(page)}>Duplicate page</button>{index > 0 && <button type="button" onClick={() => makeHomepage(page)}>Set as homepage</button>}{index > 0 && <button type="button" className="danger" onClick={() => { const links=websiteNavigation(model).filter(item=>item.type==='page'&&item.pageId===page.id).length; if (window.confirm(`Delete “${page.title}”? Its ${links} navigation link${links===1?'':'s'} will also be removed.`)) { try { const next = deleteWebsitePage(model, page.id); commit(next, { message: `${page.title} deleted and navigation updated` }); choosePage(next.pages[0]); } catch(error) { showToast(error.message); } } }}>Delete page</button>}</details></div>)}</div><label className="property-field"><span>New page name</span><input value={newPageTitle} onChange={event => setNewPageTitle(event.target.value)} /></label><button type="button" className="topbar-action" onClick={addPage}>Add page</button><div className="property-divider" /><label className="property-field"><span>Page name</span><input value={activePage.title} onChange={(event) => { const title = event.target.value; commit({ ...model, pages: pages.map(page => page.id === activePage.id ? { ...page, title } : page) }); }} /></label>{activePage.id !== pages[0].id && <><label className="property-field"><span>Page address</span><input value={activePage.slug} onChange={event => { const slug = pageSlug(event.target.value); if (!slug) return; if (pages.some(page => page.id !== activePage.id && page.slug === slug)) return showToast('This page address is already used'); commit({ ...model, pages: pages.map(page => page.id === activePage.id ? { ...page, slug } : page) }); }} /></label><button type="button" className="topbar-action" onClick={() => commit(reorderPage(model,activePage.id,-1))}>Move page up</button><button type="button" className="topbar-action" onClick={() => commit(reorderPage(model,activePage.id,1))}>Move page down</button></>}<label className="property-field"><span>Page title (SEO)</span><input value={activePage.seoTitle || ''} onChange={event => commit({ ...model, pages: pages.map(page => page.id === activePage.id ? { ...page, seoTitle: event.target.value } : page) })} /></label><label className="property-field"><span>Meta description</span><textarea value={activePage.description || ''} onChange={event => commit({ ...model, pages: pages.map(page => page.id === activePage.id ? { ...page, description: event.target.value } : page) })} /></label><label className="property-field"><span>Social sharing image URL</span><input type="url" value={activePage.socialImage || ''} placeholder="https://…" onChange={event => commit({ ...model, pages: pages.map(page => page.id === activePage.id ? { ...page, socialImage: event.target.value } : page) })} /></label><div className="property-divider"/><div className="side-heading"><span>Navigation menu</span><p>Blank labels follow page names automatically.</p></div>{websiteNavigation(model).map((item,index)=>{const target=item.type==='page'?pages.find(page=>page.id===item.pageId):null;return <div className="navigation-item-editor" key={item.id||item.pageId||item.href}><label className="property-field"><span>{target?.title||'External link'} label</span><input maxLength={60} value={item.label||''} placeholder={target?.title||'Menu label'} onChange={event=>{try{commit(setNavigationItem(model,index,{label:event.target.value}));}catch(error){showToast(error.message);}}}/></label>{item.type==='external'&&<label className="property-field"><span>External URL</span><input type="url" value={item.href} onChange={event=>{try{commit(setNavigationItem(model,index,{href:event.target.value}));}catch(error){showToast(error.message);}}}/></label>}<div className="navigation-item-actions"><button type="button" aria-label="Move menu link up" disabled={!index} onClick={()=>commit(reorderNavigation(model,index,-1))}>↑</button><button type="button" aria-label="Move menu link down" disabled={index===websiteNavigation(model).length-1} onClick={()=>commit(reorderNavigation(model,index,1))}>↓</button>{item.type==='external'&&<button type="button" onClick={()=>commit(removeNavigation(model,index))}>Remove link</button>}</div></div>})}{pages.filter(page=>!websiteNavigation(model).some(item=>item.type==='page'&&item.pageId===page.id)).map(page=><button key={`add-page-nav-${page.id}`} type="button" className="topbar-action" onClick={()=>commit(addPageNavigation(model,page.id))}>＋ Add {page.title} to menu</button>)}<form onSubmit={event=>{event.preventDefault();try{commit(addExternalNavigation(model,externalLinkLabel,externalLinkUrl));setExternalLinkLabel('');setExternalLinkUrl('');showToast('External link added');}catch(error){showToast(error.message);}}}><label className="property-field"><span>External link label</span><input value={externalLinkLabel} maxLength={60} onChange={event=>setExternalLinkLabel(event.target.value)}/></label><label className="property-field"><span>External URL</span><input type="url" placeholder="https://example.com" value={externalLinkUrl} onChange={event=>setExternalLinkUrl(event.target.value)}/></label><button type="submit" className="topbar-action">Add external link</button></form></>}
          {activeTab === "layers" && <><div className="side-heading"><span>Layers</span><p>Drag to reorder. Move buttons also work on touch devices.</p></div><div className="property-actions"><button type="button" onClick={() => { try { commit({...model,sections:groupSections(visibleSections,selectedLayers,createId('group'))});setSelectedLayers([]); } catch(error) {showToast(error.message);} }}>Group selected</button><button type="button" disabled={selected?.type !== 'group'} onClick={() => {try {commit({...model,sections:ungroupSections(visibleSections,selected.id)});}catch(error){showToast(error.message);}}}>Ungroup</button></div><div className="editor-layers-tree">{visibleSections.map(section=>renderLayer(section))}</div><button className="topbar-action" type="button" disabled={!selected} onClick={() => { setCopiedSection(clone(selected)); showToast('Section copied'); }}>Copy</button><button className="topbar-action" type="button" disabled={!copiedSection} onClick={() => { const copy=cloneSectionWithNewIds(copiedSection,prefix=>createId(prefix)); const next=selected?insertAfterSection(visibleSections,selected.id,copy):[...visibleSections,copy]; commit({...model,sections:next});setSelectedId(copy.id); }}>Paste</button></>}
          {activeTab === "collections" && <><div className="side-heading"><span>Your reusable sections</span></div><button type="button" className="topbar-action" disabled={!selected} onClick={() => { const next = [...savedSections, { ...clone(selected), id: createId('saved') }]; commit({ ...model, savedSections: next }); }}>Save selected section</button><div className="page-list">{savedSections.map(section => <div key={section.id}><button type="button" onClick={() => commit({ ...model, sections: [...visibleSections, { ...clone(section), id: createId(section.type) }] })}>{section.title || section.label}</button></div>)}</div><div className="side-heading"><span>Design Collections</span><p>Mix original sections. Keep your own brand.</p></div><div className="collection-list">{DESIGN_COLLECTIONS.map(collection => <button type="button" key={collection.id} style={{ background: collection.paper, color: collection.ink }} onClick={() => setCollectionPreview(collection)}><small>{collection.category} / {collection.variant}</small><strong>{collection.title}</strong><span>{collection.name} ↗</span></button>)}</div></>}
          {activeTab === "sections" && <><div className="side-heading"><span>Add section</span><p>Build a complete business website.</p></div><div className="section-library">{SECTION_LIBRARY.map((item) => <button type="button" key={item.type} onClick={() => addSection(item.type)}><span className="library-thumbnail"><i /><i /><b /></span><span><strong>{item.label}</strong><small>{item.description}</small></span><em>＋</em></button>)}</div></>}
          {activeTab === "elements" && <><div className="side-heading"><span>Add element</span><p>Use these anywhere in your website.</p></div><div className="element-library">{ELEMENT_LIBRARY.map((item) => <button type="button" key={item.type} onClick={() => addSection(item.type)}><b>＋</b>{item.label}</button>)}</div></>}
          {activeTab === "products" && <><div className="side-heading"><span>Your products</span><p>Choose a real product to show on your website.</p></div><button type="button" className="add-real-product" onClick={() => setShowProductPicker(true)}>＋ Add product section</button><div className="side-product-list">{products.length ? products.map((product) => <button type="button" key={product.id} onClick={() => addProduct(product)}><span className="side-product-image" style={product.imageUrl || product.image ? { backgroundImage: `url(${product.imageUrl || product.image})` } : undefined} /><span><strong>{product.name}</strong><small>{money(product.sellingPrice)}</small></span><em>＋</em></button>) : <p className="empty-copy">No products yet. Add one from your Products page first.</p>}</div></>}
          {activeTab === "design" && <><div className="side-heading"><span>Brand kit</span><p>Set a consistent identity across every page.</p></div><label className="property-field"><span>Brand logo</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={async event => { const file = event.target.files?.[0]; if (!isImageFile(file)) return showToast('Choose a JPG, PNG, WEBP or GIF image up to 20 MB.'); try { const logo = await uploadProductImage(file); commit({...currentModel.current,logo}); } catch(error) { showToast(error.message); } }} /></label><label className="property-field"><span>Body font</span><select value={model.bodyFont || 'Arial'} onChange={event => updateModelField('bodyFont',event.target.value)}>{FONTS.map(font => <option key={font}>{font}</option>)}</select></label><label className="property-field"><span>Global heading font</span><select value={model.headingFont || 'Georgia'} onChange={event => { const font=event.target.value; const previousFont=model.headingFont || 'Georgia'; const nextPages=pages.map(page=>({...page,sections:page.sections.map(section=>({...section,style:{...section.style,...(!section.style?.fontFamily || section.style.fontFamily===previousFont ? {fontFamily:font} : {})}}))})); commit({...model,headingFont:font,pages:nextPages,sections:nextPages[0].sections}); }}>{FONTS.map(font => <option key={font}>{font}</option>)}</select></label><label className="property-field"><span>Button shape</span><select value={model.buttonRadius || '0'} onChange={event => updateModelField('buttonRadius',event.target.value)}><option value="0">Square</option><option value="6px">Soft</option><option value="40px">Pill</option></select></label><div className="side-heading"><span>Design</span><p>Set the base look of your website.</p></div><label className="design-field"><span>Primary colour</span><div className="colour-input"><input type="color" value={cleanColor(model.primaryColor)} onChange={(event) => updateGlobalColor("primaryColor", event.target.value)} /><input value={model.primaryColor} onChange={(event) => updateGlobalColor("primaryColor", event.target.value)} /></div></label><label className="design-field"><span>Background colour</span><div className="colour-input"><input type="color" value={cleanColor(model.backgroundColor, "#f7f2eb")} onChange={(event) => updateGlobalColor("backgroundColor", event.target.value)} /><input value={model.backgroundColor} onChange={(event) => updateGlobalColor("backgroundColor", event.target.value)} /></div></label><label className="design-field"><span>Text colour</span><div className="colour-input"><input type="color" value={cleanColor(model.textColor,"#171513")} onChange={event=>updateGlobalColor("textColor",event.target.value)} /><input value={model.textColor||"#171513"} onChange={event=>updateGlobalColor("textColor",event.target.value)} /></div></label><p className="recent-label">Recently used</p><div className="recent-colours">{model.recentColors.map((color) => <button key={color} type="button" aria-label={`Use ${color} as primary colour`} style={{ backgroundColor: color }} onClick={() => updateGlobalColor("primaryColor", color)} />)}</div><div className="design-note">These colors change your customer website. CYB keeps its beige, white and black workspace.</div></>}
        </div>
      </aside>
      <main className="editor-canvas-wrap"><div className="canvas-meta"><span><b>Live preview</b> · click a section to edit it</span><label>Zoom <select aria-label="Canvas zoom" value={zoom} onChange={event => setZoom(Number(event.target.value))}>{[50,75,100,125].map(value => <option key={value} value={value}>{value}%</option>)}</select> · {canvasSize}</label></div><div className={`website-canvas ${device}`}><WebsiteRenderer model={model} products={products} slug={activePage.slug} device={device} onPageChange={choosePage} editText={editText} renderSection={renderSection} selectedId={selectedId} onSelectSection={setSelectedId} onDragSection={id=>setDraggedId(id)} onDropSection={handleNestedDrop} dropTarget={dropTarget} className="editor-renderer" style={{ zoom: zoom / 100 }} /></div><div className={`section-drop-zone${draggedId ? " active" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!draggedId) return; const moved = findSection(visibleSections,draggedId); if (!moved || moved.locked) return; const siblings=sectionSiblings(visibleSections,draggedId)||visibleSections; const last=siblings.at(-1); if(last && last.id!==draggedId){const next=reorderNestedSection(visibleSections,draggedId,last.id,"after");commit({ ...model, sections: next }, { message: "Section moved to bottom" });} setDraggedId(null); setDropTarget(null); }}>Drop a section here to move it to the bottom</div></main>
      <aside className="editor-properties-panel"><div className="properties-top"><span>Properties</span><small>{selected ? "Selected" : "Nothing selected"}</small></div>{propertiesPanel()}</aside>
    </div>
    {showProductPicker && <div className="editor-modal-backdrop" role="presentation" onMouseDown={() => setShowProductPicker(false)}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="product-picker-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setShowProductPicker(false)} aria-label="Close">×</button><p className="modal-kicker">Your products</p><h2 id="product-picker-title">What product do you want to add?</h2><p>Create a new product here or choose one from Products.</p><button type="button" className="add-real-product" onClick={()=>{setShowProductPicker(false);setProductForm({product:null,insert:"add"});}}>＋ Create new product</button><div className="picker-products">{products.length ? products.map((product) => <button type="button" key={product.id} onClick={() => addProduct(product)}><span className="picker-product-image" style={product.imageUrl || product.image ? { backgroundImage: `url(${product.imageUrl || product.image})` } : undefined} /><span><strong>{product.name}</strong><small>{product.description || "No description yet"}</small></span><b>{money(product.sellingPrice)}</b></button>) : <div className="empty-picker">No products yet. Choose Create new product above to add your first one.</div>}</div></section></div>}
    {showPreview && <div className="full-preview"><header><span>Preview · {activePage.title}</span><button type="button" onClick={() => setShowPreview(false)}>Back to editor</button></header><div className={`full-preview-site preview-device-${device}`}><WebsiteRenderer model={model} products={products} slug={activePage.slug} device={device} onPageChange={choosePage} /></div></div>}
    {collectionPreview && <div className="full-preview"><header><span>{collectionPreview.name} · Design Collection preview</span><div><button type="button" onClick={() => applyCollection(collectionPreview)}>Add sections to current page</button><button type="button" onClick={() => addCollectionPages(collectionPreview)}>Add all 4 pages</button><button type="button" onClick={() => setCollectionPreview(null)}>Close</button></div></header><WebsiteRenderer model={collectionWebsite(collectionPreview,createSection)} /></div>}
    {showPublish && <div className="editor-modal-backdrop" role="presentation"><section className="editor-modal publish-modal" role="dialog" aria-modal="true"><p className="modal-kicker">Published</p><h2>Your website is live.</h2><p>Your last design is now saved to your GetCyb store and will be shown on your public website.</p>{publishUrl ? <a href={publishUrl} target="_blank" rel="noreferrer">Open your website ↗</a> : <div className="publish-missing-url">Finish Store Setup to choose your public website address.</div>}<button className="topbar-action" type="button" onClick={() => setShowPublish(false)}>Done</button></section></div>}
    {productForm && <div className="editor-modal-backdrop"><section className="editor-modal" role="dialog" aria-modal="true" aria-label="Product details"><EditorProductForm product={productForm.product} onCancel={()=>setProductForm(null)} onSaved={(product,list)=>{setProducts(list);if(productForm.insert==='add')addProduct(product);else if(productForm.insert==='replace'&&selected)updateSection({productId:product.id,title:product.name,body:product.description,image:product.imageUrl,media:mediaItems(product),price:product.sellingPrice});setProductForm(null);showToast('Product saved to Products');}}/></section></div>}
    {showAiDesigner && <AiDesigner model={model} products={products} onApply={next => { commit(migrateLegacyEditor(next), { message: "AI changes added to your editor" }); setActivePageId(websitePages(next)[0]?.id || "home"); setSelectedId(websitePages(next)[0]?.sections?.[0]?.id || null); }} onClose={() => setShowAiDesigner(false)} />}
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
  return <div className="property-field"><span>Menu items</span>{items.map((item,index)=><div className="menu-repeater" style={{display:'block'}} key={index}><label>Item name<input value={item.name||''} onChange={e=>update(index,{name:e.target.value})}/></label><label>Price<input value={item.price||''} onChange={e=>update(index,{price:e.target.value})}/></label><label>Description<textarea value={item.description||''} onChange={e=>update(index,{description:e.target.value})}/></label><MediaFields items={mediaItems(item)} onChange={media=>update(index,{media})}/><button type="button" onClick={()=>onChange(items.filter((_,i)=>i!==index))}>Remove item</button></div>)}<button className="add-repeater" type="button" onClick={()=>onChange([...items,{name:'New item',price:'$0',media:[]}])}>＋ Add item</button></div>;
}

function EditableFaqItems({ items, onChange }) {
  function update(index, patch) { onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  return <div className="property-field"><span>Questions</span>{items.map((item, index) => <div className="faq-repeater" key={index}><input value={item.question} onChange={(event) => update(index, { question: event.target.value })} /><textarea rows="2" value={item.answer} onChange={(event) => update(index, { answer: event.target.value })} /></div>)}<button className="add-repeater" type="button" onClick={() => onChange([...items, { question: "New question", answer: "New answer" }])}>＋ Add question</button></div>;
}

function EditableReviewItems({ items, onChange }) {
  function update(index, patch) { onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  return <div className="property-field"><span>Customer quotes</span><small>Only use reviews your customers approved for publication.</small>{items.map((item,index)=><div className="faq-repeater" key={index}><input aria-label={`Customer name ${index + 1}`} value={item.name || ''} onChange={event=>update(index,{name:event.target.value})}/><textarea aria-label={`Customer quote ${index + 1}`} rows="3" value={item.quote || ''} onChange={event=>update(index,{quote:event.target.value})}/><button type="button" onClick={()=>onChange(items.filter((_,i)=>i!==index))}>Remove quote</button></div>)}<button className="add-repeater" type="button" onClick={()=>onChange([...items,{name:'Customer name',quote:'Add an approved customer review here.'}])}>＋ Add quote</button></div>;
}
