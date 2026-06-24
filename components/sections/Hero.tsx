import { BUSINESS } from "@/lib/content";

export function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center bg-primary pt-20"
    >
      {/* Background pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(200,162,77,0.12),transparent_60%)]" />

      <div className="relative mx-auto max-w-6xl px-6 py-24">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">
          {BUSINESS.ownerName}
        </p>

        <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
          {BUSINESS.companyName}
        </h1>

        <p className="mt-6 max-w-xl text-lg text-white/70">
          {BUSINESS.description}
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="#services"
            className="rounded-lg bg-accent px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Nasze usługi
          </a>
          <a
            href="#contact"
            className="rounded-lg border border-white/20 px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Skontaktuj się
          </a>
        </div>
      </div>
    </section>
  );
}
