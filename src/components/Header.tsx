import { useState, useEffect } from "react";
import "./Header.css";
import { type Locale } from "../i18n/config";
import { localizePathSafe, type RouteKey } from "../i18n/routes";

type NavKey = Extract<RouteKey, | "lodging" | "food" | "things" | "guides">;

const NAV: { key: NavKey; id: string }[] = [
  { key: "lodging", id: "nav-hospedarse" },
  { key: "food", id: "nav-comer" },
  { key: "things", id: "nav-que-hacer" },
  { key: "guides", id: "nav-guias" },
];

const FALLBACK_LABELS: Record<NavKey, string> = {
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

        {/* ── Left: Institutional Logos (Logo Cholula, Pueblo Mágico + Puebla on Desktop) ── */}
        <div className="header-logos header-left">
          <a href="/" className="header-logo-link" aria-label="Logo Cholula">
            <img
              src="/home/logo_cholula.webp"
              alt="Logo Cholula"
              className="header-logo-img"
              width={56}
              height={48}
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
              width={56}
              height={48}
              loading="eager"
              decoding="async"
            />
          </a>

          {/* Puebla & México logos on the left side on Desktop */}
          <div className="header-divider desktop-only-divider"></div>
          <a href="/" className="header-logo-link logo-puebla-link desktop-only-puebla" aria-label="Puebla">
            <img
              src="/home/logo_puebla.webp"
              alt="Puebla"
              className="header-logo-img logo-puebla"
              width={75}
              height={24}
              loading="eager"
              decoding="async"
            />
          </a>
          <div className="header-divider desktop-only-divider"></div>
          <a href="/" className="header-logo-link logo-mexico-link desktop-only-puebla" aria-label="México">
            <img
              src="/mexico.webp"
              alt="México"
              className="header-logo-img logo-mexico"
              width={65}
              height={24}
              loading="eager"
              decoding="async"
            />
          </a>
        </div>

        {/* ── Center: Main Hero Logo (Cholula lo tiene todo) — Centered on Desktop & Mobile ── */}
        <div className="header-center">
          <a href="/" className="header-logo-link header-logo-featured-link" aria-label="Cholula lo tiene todo">
            <img
              src="/home/cholula%20lo%20tiene%20todo_logo.webp"
              alt="Cholula lo tiene todo"
              className="header-logo-img header-logo-featured"
              width={92}
              height={92}
              loading="eager"
              decoding="async"
            />
          </a>
        </div>

        {/* ── Right: Desktop Navigation + Mobile Puebla & México Logos + selector de idioma ── */}
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

          {/* On Mobile only, Puebla and México logos shift to the right side next to language button */}
          <a href="/" className="header-logo-link logo-puebla-link mobile-only-puebla" aria-label="Puebla">
            <img
              src="/home/logo_puebla.webp"
              alt="Puebla"
              className="header-logo-img logo-puebla"
              width={75}
              height={24}
              loading="eager"
              decoding="async"
            />
          </a>
          <div className="header-divider mobile-only-puebla"></div>
          <a href="/" className="header-logo-link logo-mexico-link mobile-only-puebla" aria-label="México">
            <img
              src="/mexico.webp"
              alt="México"
              className="header-logo-img logo-mexico"
              width={65}
              height={24}
              loading="eager"
              decoding="async"
            />
          </a>

          {/* Solo se muestra si la página existe en el otro idioma */}
          {otherLocale && (
            <a
              className="header-lang"
              href={otherLocale.path}
              hrefLang={otherLocale.locale}
              lang={otherLocale.locale}
            >
              {otherLocale.locale.toUpperCase()}
            </a>
          )}
        </div>

      </div>
    </header>
  );
}
