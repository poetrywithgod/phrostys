/**
 * Shop details shown around the website. Edit these to match the real business;
 * nothing here is secret. (Later steps move delivery fees and bank details into
 * the database so the owner can change them from the admin app.)
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
