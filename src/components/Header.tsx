import { useState, useEffect } from "react";
import "./Header.css";

const navLinks = [
  { label: "Cholula", href: "/", id: "nav-cholula" },
  { label: "Dónde hospedarse", href: "/donde-hospedarse", id: "nav-hospedarse" },
  { label: "Dónde comer", href: "/donde-comer", id: "nav-comer" },
  { label: "Qué hacer", href: "/que-hacer", id: "nav-que-hacer" },
  { label: "Guías Turísticos", href: "/guias-turisticos", id: "nav-guias" },
];



export default function Header() {
  const [activeLink, setActiveLink] = useState("/");
  const [isScrolled, setIsScrolled] = useState(false);

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

        {/* ── Left: Logo ── */}
        <a href="/" className="header-logo-link" aria-label="Guía Cholula 2025">
          <img
            src="/logo_guia_cholula_2025.webp"
            alt="Guía Cholula 2025"
            className="header-logo-img"
            loading="eager"
          />
        </a>

        {/* ── Right: Desktop Navigation ── */}
        <nav className="header-nav" aria-label="Navegación principal">
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

      </div>
    </header>
  );
}
