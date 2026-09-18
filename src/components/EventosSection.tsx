import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import eventosDefault from "../data/eventos.json";
import "./EventosSection.css";

export interface Evento {
  id: number;
  titulo: string;
  descripcion: string;
  dia: number;
  mes: string;
  mes_corto: string;
  dia_semana: string;
  ubicacion: string;
  horario: string;
  imagen: string;
  url_info?: string | null;
  categoria: string;
}

interface Props {
  eventos?: Evento[];
  lang?: "es" | "en";
}

interface ModalImage {
  url: string;
  title: string;
  categoria: string;
  color: string;
}

/* ── Colores por categoría ─────────────────────── */
const CAT_COLOR: Record<string, string> = {
  Feria: "#C8860A",
  Gastronomía: "#9B2335",
  Cultura: "#7D287E",
  Naturaleza: "#82BC00",
  Música: "#1D3A6B",
  Deporte: "#EF4444",
};

function getCatColor(cat: string) {
  return CAT_COLOR[cat] ?? "#C8860A";
}

export default function EventosSection({
  eventos = eventosDefault as Evento[],
  lang = "es",
}: Props) {
  const [selectedImage, setSelectedImage] = useState<ModalImage | null>(null);
  const isEn = lang === "en";

  // Cerrar modal con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedImage(null);
    };
    if (selectedImage) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedImage]);

  return (
    <section id="eventos" className="eventos-section">
      <div className="eventos-container">
        {/* ── Header con Kicker y Título ── */}
        <div className="eventos-header">
          <p className="eventos-kicker">
            {isEn ? "WHAT'S ON AND FESTIVALS" : "CARTELERA Y FESTIVIDADES"}
          </p>
          <div className="eventos-title-wrapper">
            <div className="eventos-line" />
            <h2 className="eventos-title">{isEn ? "Events" : "Eventos"}</h2>
            <div className="eventos-line" />
          </div>
        </div>

        {/* ── Lista de eventos ── */}
        <div className="eventos-list">
          {eventos.map((evento) => {
            const color = getCatColor(evento.categoria);

            return (
              <article key={evento.id} className="evento-article">
                {/* ── LADO IZQUIERDO: Fecha, Nombre, Ubicación y Horario ── */}
                <div className="evento-left">
                  {/* Bloque de fecha */}
                  <div
                    className="evento-date-block"
                    style={{ backgroundColor: color }}
                  >
                    <div className="evento-date-main">
                      <span className="evento-dia">{evento.dia}</span>
                      <span className="evento-mes">{evento.mes_corto}</span>
                    </div>
                    <div className="evento-dia-semana">{evento.dia_semana}</div>
                  </div>

                  {/* Nombre, categoría, ubicación y horario */}
                  <div className="evento-info">
                    <span
                      className="evento-cat-badge"
                      style={{ backgroundColor: color }}
                    >
                      {evento.categoria}
                    </span>

                    <h3 className="evento-titulo">{evento.titulo}</h3>

                    {/* Metadatos: Ubicación y Horario */}
                    <div className="evento-meta">
                      <div className="evento-meta-item">
                        <svg
                          className="evento-meta-icon"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span>{evento.ubicacion}</span>
                      </div>

                      <div className="evento-meta-item">
                        <svg
                          className="evento-meta-icon"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>{evento.horario}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── LADO DERECHO: Imagen grande con click para abrir modal + Descripción ── */}
                <div className="evento-right">
                  <div
                    onClick={() =>
                      setSelectedImage({
                        url: evento.imagen,
                        title: evento.titulo,
                        categoria: evento.categoria,
                        color,
                      })
                    }
                    className="evento-img-card"
                    title={
                      isEn
                        ? "Click to view full image"
                        : "Click para ver imagen en tamaño completo"
                    }
                  >
                    {/* Imagen grande */}
                    <img
                      src={evento.imagen}
                      alt={evento.titulo}
                      className="evento-img"
                      loading="lazy"
                      decoding="async"
                    />

                    {/* Botón flotante para ver en tamaño completo al hover */}
                    <div className="evento-zoom-badge">
                      <svg
                        style={{ width: "14px", height: "14px" }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                        />
                      </svg>
                      <span>
                        {isEn ? "View full image" : "Ver imagen completa"}
                      </span>
                    </div>

                    {/* Gradient Overlay */}
                    <div className="evento-gradient" />

                    {/* Footer de la imagen: descripción */}
                    <div className="evento-desc-overlay">
                      <p className="evento-desc-text">{evento.descripcion}</p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* ── Modal Lightbox a Pantalla Completa ── */}
      {selectedImage &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="evento-modal-backdrop"
            onClick={() => setSelectedImage(null)}
          >
            {/* Botón Cerrar */}
            <button
              onClick={() => setSelectedImage(null)}
              className="evento-modal-close"
              aria-label={isEn ? "Close modal" : "Cerrar modal"}
            >
              <svg
                style={{ width: "24px", height: "24px" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Contenedor de la imagen */}
            <div
              className="evento-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                className="evento-modal-img"
              />
              <div className="evento-modal-footer">
                <span
                  className="evento-cat-badge"
                  style={{ backgroundColor: selectedImage.color, margin: 0 }}
                >
                  {selectedImage.categoria}
                </span>
                <h4 className="evento-modal-title">{selectedImage.title}</h4>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
