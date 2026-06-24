"use client";

import { CONTACT } from "@/lib/content";

export function Contact() {
  return (
    <section id="contact" className="section bg-surface">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="section-heading">{CONTACT.heading}</h2>
          <p className="section-subheading">{CONTACT.subheading}</p>
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Contact info */}
          <div className="space-y-5">
            <ContactDetail
              label="Telefon"
              value={CONTACT.phone}
              href={`tel:${CONTACT.phone.replace(/\s/g, "")}`}
            />
            <ContactDetail
              label="E-mail"
              value={CONTACT.email}
              href={`mailto:${CONTACT.email}`}
            />
            <ContactDetail
              label="Adres"
              value={`${CONTACT.address.street}, ${CONTACT.address.city}`}
            />
            <div className="grid grid-cols-2 gap-4">
              <ContactDetail label="NIP" value={CONTACT.nip} />
              <ContactDetail label="REGON" value={CONTACT.regon} />
            </div>
          </div>

          {/* Contact form */}
          <form
            onSubmit={(e) => e.preventDefault()}
            className="space-y-5 rounded-xl bg-white p-8 shadow-sm"
          >
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-text-heading"
              >
                {CONTACT.formLabels.name}
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full rounded-lg border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-text-heading"
              >
                {CONTACT.formLabels.email}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full rounded-lg border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="mb-1.5 block text-sm font-medium text-text-heading"
              >
                {CONTACT.formLabels.message}
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                required
                className="w-full rounded-lg border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              {CONTACT.formLabels.submit}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function ContactDetail({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      {href ? (
        <a
          href={href}
          className="text-lg font-medium text-primary hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="text-lg font-medium text-text-heading">{value}</p>
      )}
    </div>
  );
}
