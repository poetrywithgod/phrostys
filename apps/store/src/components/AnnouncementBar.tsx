import { announcements, shop } from '../config'
import { formatNaira } from '../lib/format'
import { useSettings } from '../lib/settings'

/** The thin scrolling strip above the header. Delivery wording comes from the shop's real settings. */
export default function AnnouncementBar() {
  const { settings } = useSettings()

  const lines: string[] = []
  if (settings && settings.free_delivery_threshold !== null && settings.local_cities.length > 0) {
    lines.push(`Free delivery on all orders above ${formatNaira(settings.free_delivery_threshold)} within ${settings.local_cities.join(', ')}`)
  }
  lines.push(`We are open ${shop.hours}`, ...announcements)

  const row = (dup: boolean) =>
    lines.map((text, i) => (
      <span key={`${dup ? 'b' : 'a'}${i}`} data-dup={dup ? '' : undefined} className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={dup}>
        <span>{text}</span>
        <span className="text-accent" aria-hidden="true">◆</span>
      </span>
    ))

  return (
    <div className="marquee overflow-hidden bg-sidebar py-2 text-xs font-medium text-sidebar-text" role="region" aria-label="Announcements">
      <div className="marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}
