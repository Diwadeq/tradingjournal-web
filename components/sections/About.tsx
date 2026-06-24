import { ABOUT } from "@/lib/content";

export function About() {
  return (
    <section id="about" className="section bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="section-heading">{ABOUT.heading}</h2>

        <div className="grid gap-12 md:grid-cols-2">
          {/* Text */}
          <div className="space-y-4">
            {ABOUT.paragraphs.map((paragraph, index) => (
              <p key={index} className="leading-relaxed text-text-body">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6">
            {ABOUT.stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-primary">{stat.value}</p>
                <p className="mt-1 text-sm text-text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
