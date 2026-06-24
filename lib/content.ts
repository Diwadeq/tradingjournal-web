/**
 * ALL website text content lives here.
 * Change business info, services, or contact details in this single file.
 */

export const BUSINESS = {
  ownerName: "Sebastian Zawada",
  companyName: 'P.H.U. "DUET"',
  fullName: 'Sebastian ZAWADA P.H.U. "DUET"',
  tagline: "Biuro rachunkowe i usługi budowlane — Lubliniec",
  description:
    "Biuro rachunkowe z ponad 25-letnim doświadczeniem. Prowadzenie ksiąg rachunkowych, doradztwo gospodarcze oraz kompleksowe usługi budowlane wykończeniowe.",
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
    `P.H.U. "DUET" to biuro rachunkowe prowadzone przez Sebastiana Zawadę, działające nieprzerwanie od 1 maja 2001 roku w Lublińcu. Specjalizujemy się w obsłudze księgowej firm — od jednoosobowych działalności po spółki.`,
    "Oprócz księgowości oferujemy doradztwo w zakresie prowadzenia działalności gospodarczej oraz profesjonalne usługi budowlane wykończeniowe. Łączymy wiedzę finansową z praktycznym doświadczeniem, dzięki czemu nasi klienci otrzymują kompleksową obsługę w jednym miejscu.",
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
    "Księgowość, doradztwo i usługi budowlane — wszystko w jednym miejscu",
  items: [
    {
      title: "Księgowość i rachunkowość",
      description:
        "Prowadzenie ksiąg rachunkowych, KPiR, ewidencji ryczałtowej. Rozliczenia PIT, CIT, VAT. Sporządzanie deklaracji podatkowych i sprawozdań finansowych.",
      icon: "calculator",
    },
    {
      title: "Doradztwo gospodarcze",
      description:
        "Doradztwo w zakresie prowadzenia działalności gospodarczej, optymalizacji podatkowej, wyboru formy opodatkowania i zarządzania finansami firmy.",
      icon: "lightbulb",
    },
    {
      title: "Usługi budowlane wykończeniowe",
      description:
        "Kompleksowe wykończenia wnętrz: posadzkarstwo, malowanie, tynkowanie, instalacje elektryczne i wodno-kanalizacyjne, stolarka budowlana.",
      icon: "wrench",
    },
    {
      title: "Usługi finansowe",
      description:
        "Pośrednictwo finansowe, pomoc w uzyskaniu kredytów i finansowania dla firm. Doradztwo w zakresie produktów finansowych.",
      icon: "banknote",
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
      title: "Znajomość branży",
      description:
        "Obsługujemy zarówno jednoosobowe działalności, jak i większe podmioty. Każdy klient dostaje rozwiązania dopasowane do swojej specyfiki.",
    },
    {
      title: "Wszystko w jednym miejscu",
      description:
        "Księgowość, doradztwo i usługi budowlane — nie musisz szukać wielu firm. Załatwiamy sprawę kompleksowo.",
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
