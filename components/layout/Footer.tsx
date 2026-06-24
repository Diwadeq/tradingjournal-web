import { BUSINESS, CONTACT, FOOTER, NAV_LINKS } from "@/lib/content";

export function Footer() {
  return (
    <footer className="bg-primary-dark text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-3">
        {/* Brand column */}
        <div>
          <p className="text-xl font-bold">{BUSINESS.companyName}</p>
          <p className="mt-2 text-sm text-white/60">{BUSINESS.tagline}</p>
        </div>

        {/* Navigation column */}
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/40">
            Nawigacja
          </p>
          <ul className="space-y-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm text-white/70 transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact column */}
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/40">
            Kontakt
          </p>
          <ul className="space-y-2 text-sm text-white/70">
            <li>{CONTACT.phone}</li>
            <li>{CONTACT.email}</li>
            <li>
              {CONTACT.address.street}, {CONTACT.address.city}
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-xs text-white/40 md:flex-row">
          <p>{FOOTER.copyright}</p>
          <div className="flex gap-6">
            {FOOTER.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-white/70"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
