import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import eventosDefault from "../data/eventos.json";
import "./EventosSection.css";

export interface Evento {
  id: number;
  titulo: string;
  descripcion: string;
  /** `null` cuando el evento aún no tiene día capturado en WordPress. */
  dia: number | null;
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

/* ── Colores por categoría ── */
const CAT_COLOR: Record<string, string> = {
  Feria: "#C8860A",
  Gastronomía: "#9B2335",
  Cultura: "#7D287E",
  Naturaleza: "#82BC00",
  Música: "#1D3A6B",
  Deporte: "#EF4444",
  Negocios: "#3B82F6",
  Familiar: "#10B981",
};

const EXTRA_COLORS = [
  "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", 
  "#14B8A6", "#F43F5E", "#6366F1", "#D946EF", "#06B6D4"
];

function getCatColor(cat: string) {
  const foundKey = Object.keys(CAT_COLOR).find(
    (k) => k.toLowerCase() === cat.toLowerCase()
  );
  if (foundKey) return CAT_COLOR[foundKey];

  let hash = 0;
  for (let i = 0; i < cat.length; i++) {
    hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  }
  return EXTRA_COLORS[Math.abs(hash) % EXTRA_COLORS.length];
}

export default function EventosSection({
  eventos = eventosDefault as Evento[],
  lang = "es",
}: Props) {
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  const isEn = lang === "en";

  // Categorías únicas de los eventos
  const categorias = Array.from(
    new Set(
      eventos
        .flatMap((e) => (e.categoria || "").split(",").map((c) => c.trim()))
        .filter((c) => Boolean(c))
    )
  );

  // Filtrar eventos por categoría
  const eventosFiltrados = selectedCategoria
    ? eventos.filter((e) =>
        (e.categoria || "")
          .split(",")
          .map((c) => c.trim())
          .includes(selectedCategoria)
      )
    : eventos;

  // Cerrar modal con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedEvento(null);
    };
    if (selectedEvento) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedEvento]);

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

        {/* ── Filtros por categoría ── */}
        {categorias.length > 0 && (
          <div className="eventos-filtros">
            {/* Botón TODOS */}
            <button
              className={`evento-filtro-btn ${!selectedCategoria ? "active" : ""}`}
              style={
                !selectedCategoria
                  ? { backgroundColor: "#C45543", color: "#ffffff", borderColor: "#C45543" }
                  : { color: "#C45543", borderColor: "#C45543" }
              }
              onClick={() => setSelectedCategoria(null)}
              aria-pressed={!selectedCategoria}
            >
              {isEn ? "ALL" : "TODOS"}
            </button>

            {categorias.map((cat) => {
              const isSelected = selectedCategoria === cat;
              const color = getCatColor(cat);
              return (
                <button
                  key={cat}
                  className={`evento-filtro-btn ${isSelected ? "active" : ""}`}
                  style={
                    isSelected
                      ? { backgroundColor: color, color: "#ffffff", borderColor: color }
                      : { color: color, borderColor: color }
                  }
                  onClick={() => setSelectedCategoria(isSelected ? null : cat)}
                  aria-pressed={isSelected}
                >
                  {cat.toUpperCase()}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Lista de eventos ── */}
        <div className="eventos-list">
          {eventosFiltrados.map((evento) => {
            const eventCats = (evento.categoria || "").split(",").map((c) => c.trim()).filter(Boolean);
            const firstCat = eventCats[0] || "";
            const color = getCatColor(firstCat);

            const hasDia = evento.dia !== null && evento.dia !== undefined;
            const hasMes = Boolean(evento.mes_corto && evento.mes_corto.trim());
            const hasDateMain = hasDia || hasMes;
            const hasDiaSemana = Boolean(evento.dia_semana && evento.dia_semana.trim());
            const hasDateBlock = hasDateMain || hasDiaSemana;

            const hasCategoria = Boolean(evento.categoria && evento.categoria.trim());
            const hasUbicacion = Boolean(evento.ubicacion && evento.ubicacion.trim());
            const hasHorario = Boolean(evento.horario && evento.horario.trim());
            const hasMeta = hasUbicacion || hasHorario;
            const hasDescripcion = Boolean(evento.descripcion && evento.descripcion.trim());

            return (
              <article key={evento.id} className="evento-article">
                {/* ── LADO IZQUIERDO: Fecha, Nombre, Ubicación y Horario ── */}
                <div className="evento-left">
                  {/* Bloque de fecha: Solo si al menos un dato de fecha existe */}
                  {hasDateBlock && (
                    <div
                      className={`evento-date-block ${!hasDateMain ? "evento-date-block-only-semana" : ""}`}
                      style={{ backgroundColor: color }}
                    >
                      {hasDateMain && (
                        <div className="evento-date-main">
                          {hasDia && <span className="evento-dia">{evento.dia}</span>}
                          {hasMes && <span className="evento-mes">{evento.mes_corto}</span>}
                        </div>
                      )}
                      {hasDiaSemana && (
                        <div className="evento-dia-semana">{evento.dia_semana}</div>
                      )}
                    </div>
                  )}

                  {/* Nombre, categoría, ubicación y horario */}
                  <div className="evento-info">
                    {hasCategoria && (
                      <div className="evento-cat-badges">
                        {eventCats.map((cat, idx) => (
                          <span
                            key={idx}
                            className="evento-cat-badge"
                            style={{ backgroundColor: getCatColor(cat) }}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}

                    <h3 className="evento-titulo">{evento.titulo}</h3>

                    {/* Metadatos: Ubicación y Horario */}
                    {hasMeta && (
                      <div className="evento-meta">
                        {hasUbicacion && (
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
                        )}

                        {hasHorario && (
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
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── LADO DERECHO: Imagen grande con click para abrir modal + Descripción recortada ── */}
                <div className="evento-right">
                  <div
                    onClick={() => setSelectedEvento(evento)}
                    className="evento-img-card"
                    title={
                      isEn
                        ? "Click to view full image and details"
                        : "Click para ver imagen y detalles completos"
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

                    {/* Botón flotante para ver en tamaño completo */}
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

                    {/* Footer de la imagen: descripción recortada a 2 líneas + Ver más */}
                    {hasDescripcion && (
                      <div className="evento-desc-overlay">
                        <p className="evento-desc-text">{evento.descripcion}</p>
                        <span className="evento-ver-mas">
                          {isEn ? "See more" : "Ver más"}
                          <svg className="evento-ver-mas-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* ── Modal Lightbox a Pantalla Completa ── */}
      {selectedEvento &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="evento-modal-backdrop"
            onClick={() => setSelectedEvento(null)}
          >
            {/* Contenedor de la imagen y los detalles */}
            <div
              className="evento-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Botón Cerrar (X) */}
              <button
                type="button"
                onClick={() => setSelectedEvento(null)}
                className="evento-modal-close"
                aria-label={isEn ? "Close modal" : "Cerrar modal"}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <div className="evento-modal-img-container">
                <img
                  src={selectedEvento.imagen}
                  alt={selectedEvento.titulo}
                  className="evento-modal-img"
                />
              </div>

              <div className="evento-modal-info">
                <div className="evento-modal-header">
                  {selectedEvento.categoria && (
                    <div className="evento-cat-badges" style={{ margin: 0 }}>
                      {selectedEvento.categoria.split(",").map((c) => c.trim()).filter(Boolean).map((cat, idx) => (
                        <span
                          key={idx}
                          className="evento-cat-badge"
                          style={{ backgroundColor: getCatColor(cat) }}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                  <h3 className="evento-modal-title">{selectedEvento.titulo}</h3>
                </div>

                {/* Metadata en el modal */}
                {(selectedEvento.ubicacion ||
                  selectedEvento.horario ||
                  selectedEvento.dia !== null ||
                  selectedEvento.mes_corto) && (
                  <div className="evento-modal-meta">
                    {(selectedEvento.dia !== null || selectedEvento.mes_corto) && (
                      <div className="evento-modal-meta-item">
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
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>
                          {[
                            selectedEvento.dia_semana,
                            selectedEvento.dia,
                            selectedEvento.mes_corto,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </span>
                      </div>
                    )}

                    {selectedEvento.ubicacion && (
                      <div className="evento-modal-meta-item">
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
                        <span>{selectedEvento.ubicacion}</span>
                      </div>
                    )}

                    {selectedEvento.horario && (
                      <div className="evento-modal-meta-item">
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
                        <span>{selectedEvento.horario}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Descripción completa */}
                {selectedEvento.descripcion && (
                  <p className="evento-modal-desc">{selectedEvento.descripcion}</p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
