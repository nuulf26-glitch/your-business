export const WEBSITE_GOALS = [
  { id: "online_store", title: "Online Store", description: "Sell products and manage customer orders.", sections: ["hero", "about", "footer"], headline: "Discover your next favourite.", action: "Shop now" },
  { id: "salon", title: "Salon & Services", description: "Show your services and accept appointments.", sections: ["hero", "services", "booking", "footer"], headline: "Your time. Your care.", action: "Book an appointment" },
  { id: "restaurant", title: "Restaurant & Café", description: "Share your menu, prices, location and opening hours.", sections: ["hero", "menu", "about", "footer"], headline: "Something worth coming together for.", action: "Explore our menu" },
  { id: "portfolio", title: "Portfolio", description: "Showcase your work and connect with new clients.", sections: ["hero", "gallery", "about", "footer"], headline: "Selected work. A personal perspective.", action: "View my work" },
  { id: "company", title: "Company & Startup", description: "Introduce your business, services and ideas.", sections: ["hero", "services", "about", "faq", "footer"], headline: "Ideas that move your business forward.", action: "Explore our services" },
  { id: "showcase", title: "Showcase / Coming Soon", description: "Introduce what you are creating, without a checkout.", sections: ["hero", "about", "footer"], headline: "A new chapter is coming.", action: "Get in touch" },
];
export function getWebsiteGoal(id) {
  const legacy = { sell_online: "online_store", move_web: "online_store", sell_store: "online_store", social_seller: "online_store", pre_order: "showcase" };
  return WEBSITE_GOALS.find((goal) => goal.id === (legacy[id] || id)) || WEBSITE_GOALS[0];
}
export function usesCommerce(goal) { return getWebsiteGoal(goal).id === "online_store"; }
