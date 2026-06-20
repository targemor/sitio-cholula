import { useState, useEffect, useRef, useCallback } from "react";
import "./SearchBar.css";

/* ─── Tipos de ítem buscable ─────────────────────────────── */
interface HorarioData {
    resumen?: string;
    detalle?: string;
    lunes?: string;
    martes?: string;
    miercoles?: string;
    jueves?: string;
    viernes?: string;
    sabado?: string;
    domingo?: string;
}

interface SearchableItem {
    id: string | number;
    label: string;           // nombre/titulo del ítem
    category: string;        // "Hotel" | "Restaurante" | "Destino" | "Imperdible"
    sublabel?: string;       // descripción o dirección (opcional)
    href: string;            // sección a la que pertenece (#hoteles, #destinos, etc.)
    searchKeywords?: string; // atributos extra para búsqueda (clasificacion, tipo comida, etc.)
    rating?: number;         // estrellas (opcional)
    horario?: HorarioData | string;
}

/* ─── Utilidad: normalizar texto para comparación ────────── */
function normalize(str: string) {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Resalta TODAS las ocurrencias de `query` en `label`,
 * comparando texto normalizado (sin acentos, minúsculas).
 * Devuelve un array de React nodes con <mark> en las coincidencias.
 */
function highlightLabel(label: string, query: string): React.ReactNode {
    const normQ = normalize(query.trim());
    if (!normQ) return label;

    const normLabel = normalize(label);
    const nodes: React.ReactNode[] = [];
    let lastIdx = 0;
    let searchFrom = 0;

    while (searchFrom < normLabel.length) {
        const idx = normLabel.indexOf(normQ, searchFrom);
        if (idx === -1) break;

        // Texto antes de la coincidencia
        if (idx > lastIdx) {
            nodes.push(label.slice(lastIdx, idx));
        }

        // Texto coincidente (tomado del original, posición idéntica)
        nodes.push(
            <mark
                key={idx}
                className="search-highlight font-black rounded px-0.5"
            >
                {label.slice(idx, idx + normQ.length)}
            </mark>
        );

        lastIdx = idx + normQ.length;
        searchFrom = lastIdx;
    }

    // Resto del texto después de la última coincidencia
    if (lastIdx < label.length) {
        nodes.push(label.slice(lastIdx));
    }

    return nodes.length > 0 ? <>{nodes}</> : label;
}

/**
 * Determina si un horario está abierto actualmente.
 * Acepta string "HH:MM-HH:MM" u objeto HorarioData (usa resumen).
 */
function isCurrentlyOpen(horario?: HorarioData | string): boolean | null {
    const resumen = typeof horario === 'string' ? horario : horario?.resumen;
    if (!resumen) return null;
    const parts = resumen.split('-');
    if (parts.length !== 2) return null;

    const [start, end] = parts;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const parseTime = (timeStr: string) => {
        const [h, m] = timeStr.trim().split(':').map(Number);
        if (isNaN(h)) return null;
        return h * 60 + (m || 0);
    };
    
    const startMin = parseTime(start);
    let endMin = parseTime(end);
    
    if (startMin === null || endMin === null) return null;

    if (endMin <= startMin) {
        endMin += 24 * 60;
    }

    let checkMin = currentMinutes;
    if (endMin > 24 * 60 && currentMinutes < startMin) {
        checkMin += 24 * 60;
    }
    
    return checkMin >= startMin && checkMin <= endMin;
}

/* ─── Props ──────────────────────────────────────────────── */
interface SearchBarProps {
    placeholder?: string;
    /** Todos los ítems buscables, inyectados desde Astro */
    items?: SearchableItem[];
}

/* ═══════════════════════════════════════════════════════════
   Componente principal
═══════════════════════════════════════════════════════════ */
export default function SearchBar({
    placeholder = "Busca lugares, restaurantes, hoteles…",
    items = [],
}: SearchBarProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchableItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /* ── Búsqueda con debounce ── */
    const search = useCallback(
        (q: string) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                const norm = normalize(q.trim());
                if (!norm) {
                    setResults([]);
                    setIsOpen(false);
                    // Emitir evento con query vacío → mostrar todo
                    document.dispatchEvent(
                        new CustomEvent("portal:search", { detail: { query: "" } })
                    );
                    return;
                }

                const queryWords = norm.split(/\s+/).filter(Boolean);

                const scoredItems = items.map((item) => {
                    const normLabel = normalize(item.label);
                    const normCat = normalize(item.category);
                    const normSub = item.sublabel ? normalize(item.sublabel) : "";
                    const normKeywords = item.searchKeywords ? normalize(item.searchKeywords) : "";
                    const horarioDetalle = typeof item.horario === 'object'
                        ? item.horario?.detalle ?? ""
                        : (item.horario ?? "");
                    const normHorario = horarioDetalle ? normalize(horarioDetalle) : "";

                    let score = 0;

                    queryWords.forEach(word => {
                        let wordScore = 0;
                        if (normLabel.includes(word)) wordScore += 3;
                        if (normCat.includes(word)) wordScore += 1;
                        if (normSub.includes(word)) wordScore += 1;
                        if (normKeywords.includes(word)) wordScore += 1;
                        if (normHorario.includes(word)) wordScore += 1;

                        if (wordScore > 0) {
                            score += wordScore;
                        }
                    });

                    // Bonus si coincide la frase exacta
                    if (normLabel.includes(norm)) score += 5;
                    else if (normSub.includes(norm) || normKeywords.includes(norm) || normHorario.includes(norm)) score += 2;
                    else if (normCat.includes(norm)) score += 1;

                    return { item, score };
                });

                const found = scoredItems
                    .filter(x => x.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .map(x => x.item);

                setResults(found);
                setIsOpen(true);

                // Emitir evento global para que las secciones filtren sus cards
                document.dispatchEvent(
                    new CustomEvent("portal:search", { detail: { query: norm, results: found } })
                );
            }, 200);
        },
        [items]
    );

    useEffect(() => {
        search(query);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, search]);

    /* ── Cerrar al hacer click fuera ── */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    /* ── Slug de directorio por categoría ── */
    const categorySlug: Record<string, string> = {
        Hotel: "hoteles",
        Restaurante: "restaurantes",
        Destino: "destinos",
        Guia: "guias",
    };

    /* ── Navegar a un resultado ── */
    const goTo = (item: SearchableItem) => {
        setQuery(item.label);
        setIsOpen(false);

        if (item.category === "Imperdible") {
            // Los imperdibles están en la home → scroll suave
            const el = document.querySelector("#imperdibles") ?? document.querySelector(item.href);
            if (el) el.scrollIntoView({ behavior: "smooth" });
        } else {
            // Redirigir a la página de la categoría pasando el id por query params
            window.location.href = `${item.href}?id=${item.id}`;
        }
    };


    /* ── Agrupar resultados por categoría ── */
    const grouped = results.reduce<Record<string, SearchableItem[]>>((acc, item) => {
        (acc[item.category] ??= []).push(item);
        return acc;
    }, {});

    const categoryIcons: Record<string, string> = {
        Hotel: "🏨",
        Restaurante: "🍽️",
        Destino: "📍",
        Imperdible: "⭐",
    };

    const showDropdown = isOpen && query.trim().length > 0;

    return (
        <div ref={containerRef} className="search-container">
            {/* ── Barra de búsqueda ── */}
            <div className={`search-input-wrapper ${focused ? "focused" : ""}`}>
                {/* Icono lupa */}
                <svg
                    className={`search-icon ${focused ? "focused" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                >
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                </svg>

                <input
                    ref={inputRef}
                    id="hero-search"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => {
                        setFocused(true);
                        if (results.length > 0) setIsOpen(true);
                    }}
                    onBlur={() => setFocused(false)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            setQuery("");
                            setIsOpen(false);
                            inputRef.current?.blur();
                        }
                    }}
                    placeholder={placeholder}
                    className="search-input"
                    aria-label="Buscar"
                    aria-autocomplete="list"
                    aria-expanded={showDropdown}
                    autoComplete="off"
                />

                {/* Botón limpiar */}
                {query && (
                    <button
                        onClick={() => {
                            setQuery("");
                            setIsOpen(false);
                            inputRef.current?.focus();
                        }}
                        className="search-clear-btn"
                        aria-label="Limpiar búsqueda"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width="16" height="16">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* ── Dropdown de resultados ── */}
            {showDropdown && (
                <div
                    className="search-dropdown"
                    role="listbox"
                    aria-label="Resultados de búsqueda"
                >
                    {results.length === 0 ? (
                        /* Empty state */
                        <div className="search-empty-state">
                            <div className="search-empty-icon">🔍</div>
                            <p className="search-empty-text">
                                Sin resultados para <span>"{query}"</span>
                            </p>
                            <p className="search-empty-hint">Intenta con otro término</p>
                        </div>
                    ) : (
                        <div className="search-results-list">
                            {Object.entries(grouped).map(([cat, catItems]) => (
                                <div key={cat}>
                                    {/* Encabezado de categoría */}
                                    <div className="search-category-header">
                                        <span className="search-category-icon">{categoryIcons[cat] ?? "📌"}</span>
                                        <span className="search-category-title">
                                            {cat}s
                                        </span>
                                    </div>

                                    {/* Ítems */}
                                    {catItems.map((item) => {
                                        const labelNode = highlightLabel(item.label, query);
                                        const sublabelNode = item.sublabel
                                            ? highlightLabel(item.sublabel, query)
                                            : null;

                                        const horarioDetalle = typeof item.horario === 'object'
                                            ? item.horario?.detalle ?? ""
                                            : "";

                                        return (
                                            <button
                                                key={`${cat}-${item.id}`}
                                                role="option"
                                                onMouseDown={(e) => { e.preventDefault(); goTo(item); }}
                                                className="search-result-item"
                                            >
                                                <div className="search-item-content">
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <p className="search-item-title">
                                                            {labelNode}
                                                        </p>
                                                        {item.horario && isCurrentlyOpen(item.horario) !== null && (
                                                            <span className={`search-badge ${isCurrentlyOpen(item.horario) ? "search-badge-open" : "search-badge-closed"}`}>
                                                                {isCurrentlyOpen(item.horario) ? "Abierto" : "Cerrado"}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {(sublabelNode || item.rating) && (
                                                        <p className="search-item-subtitle">
                                                            {sublabelNode}
                                                            {item.rating ? (
                                                                <span style={{ color: "#fbbf24", marginLeft: sublabelNode ? "6px" : "0", letterSpacing: "1px" }}>
                                                                    {"★".repeat(item.rating)}
                                                                </span>
                                                            ) : null}
                                                        </p>
                                                    )}
                                                    {horarioDetalle && (
                                                        <p className="search-item-horario">
                                                            🕐 {horarioDetalle}
                                                        </p>
                                                    )}
                                                </div>
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    className="search-item-arrow"
                                                >
                                                    <path d="m9 18 6-6-6-6" />
                                                </svg>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}

                            {/* Footer */}
                            <div className="search-footer">
                                <span className="search-footer-count">
                                    {results.length} resultado{results.length !== 1 ? "s" : ""}
                                </span>
                                <span className="search-footer-hint">
                                    ↵ para ir
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
