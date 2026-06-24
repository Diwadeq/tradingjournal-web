import { WHY_US } from "@/lib/content";

export function WhyUs() {
  return (
    <section id="why-us" className="section bg-white">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="section-heading">{WHY_US.heading}</h2>

        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_US.items.map((item, index) => (
            <div key={item.title}>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-xl font-bold text-accent">
                {index + 1}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-text-heading">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-text-body">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
