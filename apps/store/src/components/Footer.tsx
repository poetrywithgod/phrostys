import { Link } from 'react-router-dom'
import { AtSign, Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { shop } from '../config'
import Logo from './Logo'

const heading = 'font-display text-sm font-semibold text-sidebar-active'
const link = 'text-sidebar-text/90 hover:text-sidebar-active hover:underline'

export default function Footer() {
  return (
    <footer className="mt-20 bg-sidebar text-sidebar-text">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.6fr]">
        <div className="space-y-3">
          <Logo className="h-10 w-auto text-sidebar-logo" />
          <p className="max-w-xs text-sm text-sidebar-muted">{shop.tagline}</p>
        </div>

        <div className="space-y-3 text-sm">
          <h2 className={heading}>Pages</h2>
          <ul className="space-y-2">
            <li><Link to="/" className={link}>Home</Link></li>
            <li><Link to="/shop" className={link}>Shop</Link></li>
            <li><Link to="/#about" className={link}>About us</Link></li>
            <li><Link to="/contact" className={link}>Contact us</Link></li>
            <li><Link to="/cart" className={link}>Cart</Link></li>
          </ul>
        </div>

        <div className="space-y-3 text-sm">
          <h2 className={heading}>Resources</h2>
          <ul className="space-y-2">
            <li><Link to="/#faq" className={link}>FAQs</Link></li>
            <li>
              <a href={`https://wa.me/${shop.whatsapp}`} target="_blank" rel="noreferrer" className={`${link} inline-flex items-center gap-2`}>
                <MessageCircle size={15} /> WhatsApp
              </a>
            </li>
            <li><a href={`mailto:${shop.email}`} className={link}>Email us</a></li>
          </ul>
        </div>

        <div className="space-y-3 text-sm">
          <h2 className={heading}>Contact us</h2>
          <p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0" />{shop.address}</p>
          {shop.hours && <p className="flex items-center gap-2"><Clock size={16} className="shrink-0" />{shop.hours}</p>}
          <p className="flex items-center gap-2"><Phone size={16} className="shrink-0" /><span><a href={`tel:${shop.phone.replace(/\s/g, '')}`} className={link}>{shop.phone}</a><br /><a href={`tel:${shop.phone2.replace(/\s/g, '')}`} className={link}>{shop.phone2}</a></span></p>
          <p className="flex items-center gap-2"><Mail size={16} className="shrink-0" /><a href={`mailto:${shop.email}`} className={link}>{shop.email}</a></p>
          <p className="flex items-center gap-2"><AtSign size={16} className="shrink-0" /><a href={`https://instagram.com/${shop.instagram}`} target="_blank" rel="noreferrer" className={link}>@{shop.instagram}</a></p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-sidebar-muted">
        © {new Date().getFullYear()} {shop.company}. All rights reserved.
      </div>
    </footer>
  )
}
