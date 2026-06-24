/**
 * ALL website text content lives here.
 * Change business info, services, or contact details in this single file.
 */

export const BUSINESS = {
  ownerName: "Sebastian Zawada",
  companyName: 'PHU "DUET"',
  fullName: 'Sebastian Zawada – PHU "DUET"',
  tagline: "Profesjonalne usługi dla Twojego biznesu",
  description:
    "Jesteśmy firmą handlowo-usługową z wieloletnim doświadczeniem. Stawiamy na jakość, terminowość i indywidualne podejście do każdego klienta.",
  foundedYear: 2010,
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
    `PHU "DUET" to firma handlowo-usługowa prowadzona przez Sebastiana Zawadę. Od lat działamy na rynku, dostarczając naszym klientom usługi na najwyższym poziomie.`,
    "Naszą misją jest budowanie długotrwałych relacji biznesowych opartych na zaufaniu, jakości i profesjonalizmie. Każde zlecenie traktujemy indywidualnie, dopasowując rozwiązania do potrzeb klienta.",
  ],
  stats: [
    { value: "14+", label: "Lat doświadczenia" },
    { value: "500+", label: "Zadowolonych klientów" },
    { value: "100%", label: "Zaangażowania" },
  ],
} as const;

export const SERVICES = {
  heading: "Nasze usługi",
  subheading: "Oferujemy szeroki zakres usług dopasowanych do Twoich potrzeb",
  items: [
    {
      title: "Handel",
      description:
        "Kompleksowa obsługa handlowa — dostarczamy produkty i materiały najwyższej jakości w konkurencyjnych cenach.",
      icon: "shopping-bag",
    },
    {
      title: "Usługi remontowe",
      description:
        "Profesjonalne usługi remontowo-budowlane dla klientów indywidualnych i firm. Realizujemy projekty od A do Z.",
      icon: "wrench",
    },
    {
      title: "Transport",
      description:
        "Szybki i bezpieczny transport towarów. Dysponujemy nowoczesnym taborem dostosowanym do różnych potrzeb.",
      icon: "truck",
    },
    {
      title: "Doradztwo",
      description:
        "Fachowe doradztwo w zakresie doboru materiałów i planowania projektów. Pomagamy podejmować najlepsze decyzje.",
      icon: "lightbulb",
    },
  ],
} as const;

export const WHY_US = {
  heading: "Dlaczego my?",
  items: [
    {
      title: "Doświadczenie",
      description:
        "Wieloletnia obecność na rynku gwarantuje sprawdzone rozwiązania i znajomość branży.",
    },
    {
      title: "Terminowość",
      description:
        "Dotrzymujemy ustalonych terminów. Czas naszych klientów jest dla nas priorytetem.",
    },
    {
      title: "Konkurencyjne ceny",
      description:
        "Oferujemy atrakcyjne warunki cenowe bez kompromisów w kwestii jakości.",
    },
    {
      title: "Indywidualne podejście",
      description:
        "Każdy klient jest dla nas wyjątkowy. Dopasowujemy ofertę do konkretnych potrzeb.",
    },
  ],
} as const;

export const CONTACT = {
  heading: "Kontakt",
  subheading: "Skontaktuj się z nami — chętnie odpowiemy na Twoje pytania",
  phone: "+48 123 456 789",
  email: "kontakt@phu-duet.pl",
  address: {
    street: "ul. Przykładowa 10",
    city: "00-000 Warszawa",
    country: "Polska",
  },
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
