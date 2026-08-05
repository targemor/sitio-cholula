import { useState, useEffect } from "react";
import "./Header.css";
import { LOCALE_NAMES, type Locale } from "../i18n/config";
import { localizePathSafe, type RouteKey } from "../i18n/routes";

type NavKey = Extract<RouteKey, "home" | "lodging" | "food" | "things" | "guides">;

const NAV: { key: NavKey; id: string }[] = [
  { key: "home", id: "nav-cholula" },
  { key: "lodging", id: "nav-hospedarse" },
  { key: "food", id: "nav-comer" },
  { key: "things", id: "nav-que-hacer" },
  { key: "guides", id: "nav-guias" },
];

const FALLBACK_LABELS: Record<NavKey, string> = {
  home: "Cholula",
  lodging: "Dónde hospedarse",
  food: "Dónde comer",
  things: "Qué hacer",
  guides: "Guías Turísticos",
};

interface HeaderProps {
  lang?: Locale;
  /** La página actual en los idiomas donde existe. Vacío = sin traducción aún. */
  alternates?: { locale: Locale; path: string }[];
  /** Etiquetas ya resueltas para `lang`: la isla no carga el diccionario completo. */
  labels?: Record<NavKey, string>;
  ariaLabel?: string;
}

export default function Header({
  lang = "es",
  alternates = [],
  labels = FALLBACK_LABELS,
  ariaLabel = "Navegación principal",
}: HeaderProps) {
  const [activeLink, setActiveLink] = useState("/");
  const [isScrolled, setIsScrolled] = useState(false);

  const navLinks = NAV.map((link) => ({
    ...link,
    label: labels[link.key],
    href: localizePathSafe(link.key, lang),
  }));
  const otherLocale = alternates.find((alt) => alt.locale !== lang);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setActiveLink(window.location.pathname);

      const handleScroll = () => {
        // Cambia a fondo blanco al bajar un poco (50px)
        setIsScrolled(window.scrollY > 50);
      };

      window.addEventListener("scroll", handleScroll, { passive: true });
      // Estado inicial
      handleScroll();

      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, []);

  return (
    <header className={`site-header ${isScrolled ? "scrolled" : ""}`}>
      <div className="header-inner">

        {/* ── Left: Logos ── */}
        <div className="header-logos">
          <a href="/" className="header-logo-link" aria-label="Logo Cholula">
            <img
              src="/home/logo_cholula.webp"
              alt="Logo Cholula"
              className="header-logo-img"
              width={65}
              height={56}
              loading="eager"
              decoding="async"
            />
          </a>
          <div className="header-divider"></div>
          <a href="/" className="header-logo-link" aria-label="Cholula lo tiene todo">
            <img
              src="/home/cholula%20lo%20tiene%20todo_logo.webp"
              alt="Cholula lo tiene todo"
              className="header-logo-img"
              width={56}
              height={56}
              loading="eager"
              decoding="async"
            />
          </a>
          <div className="header-divider"></div>
          <a href="/" className="header-logo-link" aria-label="Cholula Pueblo Mágico">
            <img
              src="/home/cholula_pueblo_magico.webp"
              alt="Cholula Pueblo Mágico"
              className="header-logo-img"
              width={65}
              height={56}
              loading="eager"
              decoding="async"
            />
          </a>
          <div className="header-divider"></div>
          <a href="/" className="header-logo-link" aria-label="Puebla">
            <img
              src="/home/logo_puebla.webp"
              alt="Puebla"
              className="header-logo-img logo-puebla"
              width={85}
              height={24}
              loading="eager"
              decoding="async"
            />
          </a>
        </div>

        {/* ── Right: Desktop Navigation + selector de idioma ── */}
        <div className="header-right">
          <nav className="header-nav" aria-label={ariaLabel}>
            {navLinks.map((link) => (
              <a
                key={link.id}
                id={link.id}
                href={link.href}
                className={`header-nav-link${activeLink === link.href ? " header-nav-link--active" : ""}`}
                onClick={() => setActiveLink(link.href)}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Solo se muestra si la página existe en el otro idioma */}
          {otherLocale && (
            <a
              className="header-lang"
              href={otherLocale.path}
              hrefLang={otherLocale.locale}
              lang={otherLocale.locale}
            >
              {LOCALE_NAMES[otherLocale.locale]}
            </a>
          )}
        </div>

      </div>
    </header>
  );
}
