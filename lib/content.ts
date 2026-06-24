/**
 * ALL website text content lives here.
 * Change business info, services, or contact details in this single file.
 */

export const BUSINESS = {
  ownerName: "Sebastian Zawada",
  companyName: 'P.H.U. "DUET"',
  fullName: 'Sebastian ZAWADA P.H.U. "DUET"',
  tagline: "Biuro rachunkowe — Lubliniec",
  description:
    "Biuro rachunkowe z ponad 25-letnim doświadczeniem. Kompleksowa obsługa księgowa firm, rozliczenia podatkowe, kadry i płace oraz doradztwo gospodarcze.",
  foundedYear: 2001,
  nip: "5751290834",
  regon: "151991203",
  legalForm: "Indywidualna działalność gospodarcza",
} as const;

export const NAV_LINKS = [
  { label: "Strona główna", href: "#hero" },
  { label: "O firmie", href: "#about" },
  { label: "Usługi", href: "#services" },
  { label: "Dlaczego my", href: "#why-us" },
  { label: "Aktualności", href: "#tax-news" },
  { label: "Kontakt", href: "#contact" },
] as const;

export const ABOUT = {
  heading: "O firmie",
  paragraphs: [
    `P.H.U. "DUET" to biuro rachunkowe prowadzone przez Sebastiana Zawadę, działające nieprzerwanie od 1 maja 2001 roku w Lublińcu. Specjalizujemy się w kompleksowej obsłudze księgowej firm — od jednoosobowych działalności po spółki.`,
    "Naszym klientom zapewniamy rzetelne prowadzenie ksiąg rachunkowych, terminowe rozliczenia z urzędem skarbowym i ZUS-em oraz bieżące doradztwo podatkowe. Śledzimy zmiany w przepisach, żeby nasi klienci mogli skupić się na prowadzeniu biznesu.",
  ],
  stats: [
    { value: "25+", label: "Lat na rynku" },
    { value: "Od 2001", label: "Rok założenia" },
    { value: "100%", label: "Zaangażowania" },
  ],
} as const;

export const SERVICES = {
  heading: "Nasze usługi",
  subheading:
    "Kompleksowa obsługa księgowa i doradztwo dla Twojej firmy",
  items: [
    {
      title: "Księgi rachunkowe i KPiR",
      description:
        "Prowadzenie pełnych ksiąg rachunkowych, KPiR oraz ewidencji ryczałtowej. Sporządzanie sprawozdań finansowych i bilansów.",
      icon: "calculator",
    },
    {
      title: "Rozliczenia podatkowe",
      description:
        "Deklaracje PIT, CIT, VAT, JPK. Rozliczenia z urzędem skarbowym i ZUS. Reprezentacja przed organami podatkowymi.",
      icon: "file-text",
    },
    {
      title: "Kadry i płace",
      description:
        "Prowadzenie dokumentacji kadrowej, naliczanie wynagrodzeń, rozliczenia ZUS, umowy o pracę i zlecenia, świadectwa pracy.",
      icon: "users",
    },
    {
      title: "Doradztwo gospodarcze",
      description:
        "Wybór formy opodatkowania, optymalizacja podatkowa, zakładanie działalności, doradztwo w zakresie zarządzania finansami firmy.",
      icon: "lightbulb",
    },
  ],
} as const;

export const WHY_US = {
  heading: "Dlaczego my?",
  items: [
    {
      title: "25 lat doświadczenia",
      description:
        "Działamy od 2001 roku. Znamy polskie przepisy podatkowe od podszewki i śledzimy każdą zmianę, by nasi klienci byli zawsze na bieżąco.",
    },
    {
      title: "Pełna obsługa księgowa",
      description:
        "Księgi, podatki, kadry, ZUS — wszystko w jednym biurze. Nie musisz szukać osobnych specjalistów do każdego tematu.",
    },
    {
      title: "Indywidualne podejście",
      description:
        "Każda firma jest inna. Dopasowujemy formę rozliczeń i zakres obsługi do specyfiki działalności klienta.",
    },
    {
      title: "Lubliniec i okolice",
      description:
        "Jesteśmy lokalni. Znamy realia prowadzenia firmy w regionie i jesteśmy dostępni na miejscu, kiedy trzeba.",
    },
  ],
} as const;

export const CONTACT = {
  heading: "Kontakt",
  subheading: "Skontaktuj się z nami — chętnie odpowiemy na Twoje pytania",
  phone: "+48 XXX XXX XXX",
  email: "kontakt@phu-duet.pl",
  address: {
    street: "ul. Oleska 34",
    city: "42-700 Lubliniec",
    country: "Polska",
  },
  nip: "NIP: 575 129 08 34",
  regon: "REGON: 151991203",
  formLabels: {
    name: "Imię i nazwisko",
    email: "Adres e-mail",
    message: "Wiadomość",
    submit: "Wyślij wiadomość",
  },
} as const;

export const TAX_NEWS = {
  heading: "Podatki i przepisy dla firm",
  subheading:
    "Najnowsze zmiany podatkowe, interpretacje i przepisy istotne dla księgowych i przedsiębiorców",
  feeds: [
    {
      url: "https://www.infor.pl/rss/podatki.xml",
      label: "Infor – Podatki",
    },
    {
      url: "https://ksiegowosc.infor.pl/rss/rachunkowosc.xml",
      label: "Infor – Księgowość",
    },
    {
      url: "https://serwisy.gazetaprawna.pl/podatki/rss.xml",
      label: "Gazeta Prawna – Podatki",
    },
  ],
  maxItems: 9,
  readMoreLabel: "Czytaj więcej",
  allLabel: "Wszystkie",
  emptyMessage: "Brak aktualności do wyświetlenia.",
  errorMessage:
    "Nie udało się załadować aktualności. Spróbuj ponownie później.",
  retryLabel: "Spróbuj ponownie",
} as const;

export const FOOTER = {
  copyright: `© ${new Date().getFullYear()} ${BUSINESS.fullName}. Wszelkie prawa zastrzeżone.`,
  links: [
    { label: "Polityka prywatności", href: "/privacy" },
    { label: "Regulamin", href: "/terms" },
  ],
} as const;
