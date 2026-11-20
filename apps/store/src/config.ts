/**
 * Shop details and wording for the website. Edit these to match the real
 * business; nothing here is secret. (Later steps move delivery fees and bank
 * details into the database so the owner can change them from the admin app.)
 *
 * The wording below is a first draft: replace it with the client's own words.
 */
export const shop = {
  name: 'Phrostys',
  tagline: 'Quality you can trust, delivered to your door.',
  phone: '+234 800 000 0000',
  whatsapp: '2348000000000', // digits only, with country code, no +
  email: 'hello@phrostys.com',
  address: 'Shop address goes here, Port Harcourt',
  hours: 'Mon to Sat, 8am to 6pm',
} as const

/**
 * Photo for the Contact page. Put the image in apps/store/public/ with this file
 * name (a shop front, the team, or the products). Until it is there, a branded
 * panel is shown instead.
 */
export const contactPhoto = {
  src: '/contact.jpg',
  alt: 'The Phrostys shop',
} as const

export const hero = {
  title: 'Everything you need,',
  emphasis: 'delivered fresh.',
  text: 'Browse our range, pay securely online, and choose delivery or pickup. It takes a couple of minutes.',
} as const

export const features = [
  { icon: 'shield', title: 'Quality you can trust', text: 'Carefully sourced products that meet our standard, every time.' },
  { icon: 'grid', title: 'Wide selection', text: 'From everyday essentials to bulk buys, find what you need in one place.' },
  { icon: 'truck', title: 'Fast, reliable delivery', text: 'Ordered today, at your door soon. Or pick up from our shop.' },
  { icon: 'wallet', title: 'Pay your way', text: 'Card, bank transfer, Opay, Kuda, PalmPay, Moniepoint and more.' },
] as const

export const about = {
  title: 'About us',
  text: 'Our goal is simple: to give you good products at fair prices, with service you can count on. Whether you shop in store or online, we treat every order with the same care.',
} as const

export const faqs = [
  { q: 'Do you deliver?', a: 'Yes. Choose delivery at checkout and we bring your order to your address. Delivery fees depend on your location and are shown before you pay.' },
  { q: 'Can I pick up my order instead?', a: 'Yes. Choose pickup at checkout and collect from our shop during opening hours.' },
  { q: 'How can I pay?', a: 'You can pay by card or bank transfer, including from Opay, Kuda, PalmPay, Moniepoint and other bank apps.' },
  { q: 'What if something I want is sold out?', a: 'Sold-out items are marked on the shop page. Message us on WhatsApp and we’ll tell you when it’s back.' },
  { q: 'How do I reach you?', a: 'Call, email or message us on WhatsApp. Our details are at the bottom of every page.' },
] as const

/** Extra lines for the scrolling bar at the very top. Delivery and opening hours are added automatically. */
export const announcements: readonly string[] = ['Pay securely by card or bank transfer']

/** Short notes shown on the cart page. Edit freely. */
export const deliveryNotes: readonly string[] = [
  'Delivery fees are shown at checkout and may vary by location',
  'Prefer to collect? Choose pickup at checkout',
  'Pay by card or bank transfer (Opay, Kuda, PalmPay, Moniepoint and more) through Paystack',
  'Pay on delivery is available within Port Harcourt',
  'Payments are processed securely by Paystack',
]

export const nigerianStates: readonly string[] = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta',
  'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
  'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]
