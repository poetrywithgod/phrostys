import { Link } from 'react-router-dom'
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { shop } from '../config'
import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="mt-20 bg-sidebar text-sidebar-text">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
        <div className="space-y-3">
          <Logo className="h-10 w-auto text-sidebar-logo" />
          <p className="max-w-xs text-sm text-sidebar-muted">{shop.tagline}</p>
        </div>

        <div className="space-y-3 text-sm">
          <h2 className="font-display text-base font-semibold">Visit or call us</h2>
          <p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0" />{shop.address}</p>
          <p className="flex items-center gap-2"><Clock size={16} className="shrink-0" />{shop.hours}</p>
          <p className="flex items-center gap-2"><Phone size={16} className="shrink-0" />{shop.phone}</p>
          <p className="flex items-center gap-2"><Mail size={16} className="shrink-0" />{shop.email}</p>
        </div>

        <div className="space-y-3 text-sm">
          <h2 className="font-display text-base font-semibold">Quick links</h2>
          <ul className="space-y-2">
            <li><Link to="/shop" className="hover:underline">Shop all products</Link></li>
            <li><Link to="/cart" className="hover:underline">Your cart</Link></li>
            <li>
              <a href={`https://wa.me/${shop.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:underline">
                <MessageCircle size={16} /> Chat on WhatsApp
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-sidebar-muted">
        © {new Date().getFullYear()} {shop.name}. All rights reserved.
      </div>
    </footer>
  )
}
