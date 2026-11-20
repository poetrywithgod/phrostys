/**
 * Shop details and wording for the website. Edit these to match the real
 * business; nothing here is secret. (Later steps move delivery fees and bank
 * details into the database so the owner can change them from the admin app.)
 *
 * The wording below is a first draft: replace it with the client's own words.
 */
export const shop = {
  name: 'Phrostys',
  company: 'Frosty’s Global Enterprises Limited',
  tagline: 'Nigerian staples, made from locally grown crops.',
  phone: '+234 805 515 3272',
  phone2: '+234 908 233 3360',
  whatsapp: '2348055153272', // digits only, with country code, no +
  email: 'ianonyii@gmail.com',
  instagram: 'Phrosty_ng', // handle without the @
  address: 'Port Harcourt, Rivers State', // add the street address when confirmed
  hours: '', // leave empty to hide opening hours everywhere, or e.g. 'Mon to Sat, 8am to 6pm'
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
  title: 'Wholesome Nigerian staples,',
  emphasis: 'from our harvest to your table.',
  text: 'Pap, tombrown cereal, fufu flour, soya milk powder, bambara flour and more. Pay securely online and choose delivery or pickup.',
} as const

export const features = [
  { icon: 'shield', title: 'Natural and NAFDAC approved', text: '100% natural, with no artificial colour and no preservatives.' },
  { icon: 'grid', title: 'Made from local crops', text: 'Locally grown crops turned into nutritious, value-added products.' },
  { icon: 'truck', title: 'Fast, reliable delivery', text: 'Ordered today, at your door soon. Or pick up from a pickup point near you.' },
  { icon: 'wallet', title: 'Pay your way', text: 'Card, bank transfer, Opay, Kuda, PalmPay, Moniepoint and more.' },
] as const

export const about = {
  title: 'About us',
  text: 'Frosty’s Global Enterprises Limited is a Nigerian agri-processing company that transforms locally grown crops into high-quality, nutritious, value-added products. We supply households, food service providers, retail and wholesale markets with convenient, dependable staples.',
  supplies: ['Households', 'Food service providers', 'Retail and wholesale markets'],
  custom: { title: 'We take custom orders!', text: 'You tell us what you want, we make it.' },
  vision: {
    title: 'Our vision',
    text: 'To be a globally respected leader in agri-processed foods, delivering nutritious, affordable, and innovative products that set a new standard for quality, while establishing Africa as a trusted source of world-class food.',
  },
  mission: {
    title: 'Our mission',
    text: 'We turn Africa’s finest harvests into safe, nutritious, and innovative foods, empowering farmers, developing our people, and upholding the highest quality standards to drive sustainable growth in local and global markets.',
  },
} as const

export const faqs = [
  { q: 'Do you deliver?', a: 'Yes. Choose delivery at checkout and we bring your order to your address. Delivery fees depend on your location and are shown before you pay.' },
  { q: 'Can I pick up my order instead?', a: 'Yes. Choose pickup at checkout, pick one of our pickup points in Port Harcourt, and collect your order for free.' },
  { q: 'Do you take custom orders?', a: 'Yes. Tell us what you want and we make it, including custom flour mixes. Message us on WhatsApp with your request.' },
  { q: 'Do you sell in bulk to shops and food businesses?', a: 'Yes. We supply households, food service providers, and retail and wholesale markets. Call or message us for bulk prices.' },
  { q: 'How can I pay?', a: 'You can pay by card or bank transfer, including from Opay, Kuda, PalmPay, Moniepoint and other bank apps.' },
  { q: 'What if something I want is sold out?', a: 'Sold-out items are marked on the shop page. Message us on WhatsApp and we’ll tell you when it’s back.' },
  { q: 'How do I reach you?', a: 'Call, email, message us on WhatsApp or find us on Instagram. Our details are at the bottom of every page.' },
] as const

/** Extra lines for the scrolling bar at the very top. Delivery (and opening hours, if set) are added automatically. */
export const announcements: readonly string[] = ['Pay securely by card or bank transfer', 'We take custom orders']

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
