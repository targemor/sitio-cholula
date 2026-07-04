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
 * Verifica si una palabra de b\u00fasqueda coincide con un texto.
 * Cubre tres casos:
 *  1. Subcadena exacta: "bar" encuentra "kitchen bar"
 *  2. Prefijo del query sobre token: "bares" \u2192 token "bar" en el texto \u2713
 *  3. Prefijo del token sobre query: "restauran" \u2192 token "restaurante" \u2713
 * El m\u00ednimo de 2 caracteres evita falsos positivos con palabras muy cortas.
 */
function matchesWord(queryWord: string, text: string): boolean {
    if (queryWord.length < 2) return false;
    const tokens = text.split(/[\s,\u00b7\/\-\u2013\u2022()]+/).filter(w => w.length > 1);
    return tokens.some(
        token => queryWord.startsWith(token) || token.startsWith(queryWord)
    );
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

const DAY_KEYS: (keyof HorarioData)[] = [
    'domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'
];

function parseMinutes(timeStr: string): number | null {
    const [h, m] = timeStr.trim().split(':').map(Number);
    if (isNaN(h)) return null;
    return h * 60 + (m || 0);
}

function checkSlot(slot: string): boolean {
    if (!slot || slot === 'cerrado') return false;
    const parts = slot.split('-');
    if (parts.length !== 2) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const startMin = parseMinutes(parts[0]);
    let endMin = parseMinutes(parts[1]);
    if (startMin === null || endMin === null) return false;

    if (endMin <= startMin) endMin += 24 * 60;
    const checkMin = endMin > 24 * 60 && currentMinutes < startMin
        ? currentMinutes + 24 * 60
        : currentMinutes;

    return checkMin >= startMin && checkMin <= endMin;
}

/**
 * Determina si un establecimiento está abierto ahora.
 * Con HorarioData revisa el slot del día actual antes de caer al resumen.
 */
function isCurrentlyOpen(horario?: HorarioData | string): boolean | null {
    if (!horario) return null;

    if (typeof horario === 'string') {
        return horario ? checkSlot(horario) : null;
    }

    // Intenta usar el slot del día actual
    const todayKey = DAY_KEYS[new Date().getDay()];
    const todaySlot = horario[todayKey];

    if (todaySlot !== undefined) {
        if (todaySlot === 'cerrado') return false;
        if (todaySlot) return checkSlot(todaySlot);
    }

    // Fallback al resumen general
    return horario.resumen ? checkSlot(horario.resumen) : null;
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
    const [openNow, setOpenNow] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openNowItems = openNow
        ? items.filter(item => isCurrentlyOpen(item.horario) === true)
        : [];

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
                const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const exactRegex = new RegExp("\\b" + escapeRegExp(norm), "i");

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
                        if (matchesWord(word, normLabel)) wordScore += 3;
                        if (matchesWord(word, normCat)) wordScore += 2;
                        if (matchesWord(word, normSub)) wordScore += 1;
                        if (matchesWord(word, normKeywords)) wordScore += 1;
                        if (matchesWord(word, normHorario)) wordScore += 1;

                        if (wordScore > 0) {
                            score += wordScore;
                        }
                    });

                    // Bonus si coincide la frase exacta
                    if (exactRegex.test(normLabel)) score += 5;
                    else if (exactRegex.test(normSub) || exactRegex.test(normKeywords) || exactRegex.test(normHorario)) score += 2;
                    else if (exactRegex.test(normCat)) score += 1;

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

    // Items a mostrar: si hay query usa resultados de búsqueda; si no, todos los ítems
    const baseItems = query.trim() ? results : openNow ? items : [];
    const displayItems = openNow
        ? baseItems.filter(item => isCurrentlyOpen(item.horario) === true)
        : baseItems;

    const displayGrouped = displayItems.reduce<Record<string, SearchableItem[]>>((acc, item) => {
        (acc[item.category] ??= []).push(item);
        return acc;
    }, {});

    const showDropdown = (isOpen && query.trim().length > 0) || openNow;

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
                            setOpenNow(false);
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
                {(query || openNow) && (
                    <button
                        onClick={() => {
                            setQuery("");
                            setIsOpen(false);
                            setOpenNow(false);
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

            {/* ── Dropdown unificado ── */}
            {showDropdown && (
                <div
                    className="search-dropdown"
                    role="listbox"
                    aria-label="Resultados de búsqueda"
                >
                    {/* Chip "Abiertos ahora" dentro del dropdown */}
                    <div className="search-filter-row">
                        <button
                            className={`search-filter-chip ${openNow ? "search-filter-chip--active" : ""}`}
                            onMouseDown={(e) => { e.preventDefault(); setOpenNow(v => !v); }}
                        >
                            <span className={`search-filter-dot ${openNow ? "search-filter-dot--on" : ""}`} />
                            Abiertos ahora
                        </button>
                    </div>

                    {displayItems.length === 0 ? (
                        <div className="search-empty-state">
                            <div className="search-empty-icon">{openNow ? "🔒" : "🔍"}</div>
                            <p className="search-empty-text">
                                {openNow && !query
                                    ? "Ningún establecimiento abierto en este momento"
                                    : openNow
                                    ? <>Sin resultados abiertos para <span>"{query}"</span></>
                                    : <>Sin resultados para <span>"{query}"</span></>}
                            </p>
                            {!openNow && <p className="search-empty-hint">Intenta con otro término</p>}
                        </div>
                    ) : (
                        <div className="search-results-list">
                            {Object.entries(displayGrouped).map(([cat, catItems]) => (
                                <div key={cat}>
                                    <div className="search-category-header">
                                        <span className="search-category-icon">{categoryIcons[cat] ?? "📌"}</span>
                                        <span className="search-category-title">{cat}s</span>
                                    </div>

                                    {catItems.map((item) => {
                                        const labelNode = query ? highlightLabel(item.label, query) : item.label;
                                        const sublabelNode = item.sublabel
                                            ? (query ? highlightLabel(item.sublabel, query) : item.sublabel)
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
                                                                <span style={{ color: "var(--color-accent)", marginLeft: sublabelNode ? "6px" : "0", letterSpacing: "1px" }}>
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
                                    {openNow && !query
                                        ? `${displayItems.length} abierto${displayItems.length !== 1 ? "s" : ""} ahora`
                                        : `${displayItems.length} resultado${displayItems.length !== 1 ? "s" : ""}${openNow ? " abiertos" : ""}`}
                                </span>
                                <span className="search-footer-hint">↵ para ir</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
