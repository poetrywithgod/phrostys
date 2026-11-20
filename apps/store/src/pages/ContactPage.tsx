import { useState, type FormEvent } from 'react'
import { Clock, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react'
import Logo from '../components/Logo'
import { Field, fieldClass, primaryBtn } from '../components/ui'
import { contactPhoto, shop } from '../config'
import { useSettings } from '../lib/settings'

/** The shop photo, or a branded panel until a real photo is added to /public. */
function ContactPhoto() {
  const [missing, setMissing] = useState(false)
  if (missing) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-3xl bg-sidebar p-10 lg:aspect-auto lg:min-h-[28rem]" role="img" aria-label={contactPhoto.alt}>
        <Logo className="w-3/4 max-w-xs text-sidebar-logo" />
      </div>
    )
  }
  return (
    <img
      src={contactPhoto.src}
      alt={contactPhoto.alt}
      onError={() => setMissing(true)}
      className="aspect-[4/3] w-full rounded-3xl object-cover lg:aspect-auto lg:h-full lg:min-h-[28rem]"
    />
  )
}

export default function ContactPage() {
  const { settings } = useSettings()
  const pickupPoints = settings?.pickup_enabled ? settings.pickup_address : []
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [tried, setTried] = useState(false)

  const phoneHref = `tel:${shop.phone.replace(/\s/g, '')}`
  const nameError = tried && !name.trim() ? 'Enter your name.' : undefined
  const messageError = tried && !message.trim() ? 'Write your message.' : undefined

  // There is no inbox on the server yet, so the message opens in WhatsApp, ready to send.
  const send = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!name.trim() || !message.trim()) return
    const text = `Hello ${shop.name}, my name is ${name.trim()}.\n\n${message.trim()}`
    window.open(`https://wa.me/${shop.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  const row = 'flex items-start gap-3'
  const icon = 'mt-0.5 shrink-0 text-primary'

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Contact us</p>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">We’d love to hear from you</h1>
        <p className="mt-3 text-muted">Questions about an order, a product or delivery? Reach us any way that suits you.</p>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ContactPhoto />

        <div className="space-y-6">
          <section aria-labelledby="reach-heading" className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 id="reach-heading" className="font-display text-2xl font-semibold">Get in touch</h2>
            <ul className="mt-4 space-y-4 text-sm">
              <li className={row}><MapPin size={18} className={icon} /><span><span className="block font-semibold">Our shop</span>{shop.address}</span></li>
              <li className={row}><Clock size={18} className={icon} /><span><span className="block font-semibold">Opening hours</span>{shop.hours}</span></li>
              <li className={row}><Phone size={18} className={icon} /><span><span className="block font-semibold">Call us</span><a href={phoneHref} className="hover:underline">{shop.phone}</a></span></li>
              <li className={row}><MessageCircle size={18} className={icon} /><span><span className="block font-semibold">WhatsApp</span><a href={`https://wa.me/${shop.whatsapp}`} target="_blank" rel="noreferrer" className="hover:underline">Chat with us</a></span></li>
              <li className={row}><Mail size={18} className={icon} /><span><span className="block font-semibold">Email</span><a href={`mailto:${shop.email}`} className="hover:underline">{shop.email}</a></span></li>
            </ul>
          </section>

          {pickupPoints.length > 0 && (
            <section aria-labelledby="pickup-heading" className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <h2 id="pickup-heading" className="font-display text-2xl font-semibold">Pickup points</h2>
              <p className="mt-1 text-sm text-muted">Choose any of these at checkout and collect your order for free.</p>
              <ul className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                {pickupPoints.map((p) => (
                  <li key={p} className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-primary" />{p}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <section aria-labelledby="message-heading" className="mx-auto mt-12 max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h2 id="message-heading" className="font-display text-2xl font-semibold">Send us a message</h2>
        <p className="mt-1 text-sm text-muted">Your message opens in WhatsApp, ready to send.</p>
        <form onSubmit={send} noValidate className="mt-5 space-y-5">
          <Field id="contact-name" label="Your name" required error={nameError}>
            <input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={nameError ? true : undefined} className={fieldClass} />
          </Field>
          <Field id="contact-message" label="Message" required error={messageError}>
            <textarea id="contact-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={1000} aria-invalid={messageError ? true : undefined} className={fieldClass} />
          </Field>
          <button type="submit" className={`${primaryBtn} !rounded-xl px-8`}><Send size={16} /> Send on WhatsApp</button>
        </form>
      </section>
    </div>
  )
}
