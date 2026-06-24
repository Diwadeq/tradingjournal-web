import { SERVICES } from "@/lib/content";
import { ServiceIcon } from "@/components/sections/ServiceIcon";

export function Services() {
  return (
    <section id="services" className="section bg-surface">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="section-heading">{SERVICES.heading}</h2>
        <p className="section-subheading">{SERVICES.subheading}</p>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.items.map((service) => (
            <article
              key={service.title}
              className="rounded-xl bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-primary/5 text-primary">
                <ServiceIcon name={service.icon} />
              </div>
              <h3 className="mb-3 text-lg font-semibold text-text-heading">
                {service.title}
              </h3>
              <p className="text-sm leading-relaxed text-text-body">
                {service.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
