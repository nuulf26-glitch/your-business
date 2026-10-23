export const BUSINESS_CATEGORIES = [
  { id: 'salon', title: 'Salon & Beauty', description: 'Services, staff, appointments and clients.', modules: ['services', 'staff', 'appointments'] },
  { id: 'restaurant', title: 'Restaurants & Cafés', description: 'Digital menus, tables, reservations and pickup.', modules: ['menu', 'tables', 'reservations'] },
  { id: 'store', title: 'Online Store', description: 'Products, inventory, orders and customers.', modules: ['products', 'orders'] },
  { id: 'services', title: 'Service Business', description: 'Services, appointments and client inquiries.', modules: ['services', 'staff', 'appointments', 'inquiries'] },
  { id: 'portfolio', title: 'Portfolio & Personal Brand', description: 'Projects, galleries and professional inquiries.', modules: ['projects', 'inquiries'] },
  { id: 'general', title: 'General Business', description: 'Your website, contact requests and business information.', modules: ['inquiries'] },
];
export function categoryFor(store) {
  return BUSINESS_CATEGORIES.find(category => category.id === store?.businessCategory) || BUSINESS_CATEGORIES[2];
}
