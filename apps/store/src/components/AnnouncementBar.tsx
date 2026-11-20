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

  // Two identical halves, each long enough to be wider than any screen, so the strip
  // loops without a gap. The track slides left by exactly one half, then repeats.
  const COPIES = 6
  const SECONDS_PER_LINE = 5
  const half = (dup: boolean) =>
    Array.from({ length: COPIES }).flatMap((_, c) =>
      lines.map((text, i) => (
        <span key={`${dup ? 'b' : 'a'}${c}-${i}`} data-dup={dup || c > 0 ? '' : undefined} className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={dup || c > 0}>
          <span>{text}</span>
          <span className="text-accent" aria-hidden="true">◆</span>
        </span>
      )),
    )

  return (
    <div className="marquee overflow-hidden bg-sidebar py-2 text-xs font-medium text-sidebar-text" role="region" aria-label="Announcements">
      <div className="marquee-track flex w-max" style={{ animationDuration: `${lines.length * COPIES * SECONDS_PER_LINE}s` }}>
        {half(false)}
        {half(true)}
      </div>
    </div>
  )
}
