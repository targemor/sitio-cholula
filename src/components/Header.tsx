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

        {/* ── Left: Logos ── */}
        <div className="header-logos">
          <a href="/" className="header-logo-link" aria-label="Logo Cholula">
            <img
              src="/home/logo_cholula.png"
              alt="Logo Cholula"
              className="header-logo-img"
              loading="eager"
            />
          </a>
          <div className="header-divider"></div>
          <a href="/" className="header-logo-link" aria-label="Cholula lo tiene todo">
            <img
              src="/home/cholula%20lo%20tiene%20todo_logo.png"
              alt="Cholula lo tiene todo"
              className="header-logo-img"
              loading="eager"
            />
          </a>
          <div className="header-divider"></div>
          <a href="/" className="header-logo-link" aria-label="Cholula Pueblo Mágico">
            <img
              src="/home/cholula_pueblo_magico.png"
              alt="Cholula Pueblo Mágico"
              className="header-logo-img"
              loading="eager"
            />
          </a>
        </div>

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
