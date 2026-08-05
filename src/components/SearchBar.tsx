import { useState, useEffect, useRef, useCallback } from "react";
import "./SearchBar.css";
import {
    trackSearch,
    trackResultClick,
    trackShortcutClick,
    trackFilterToggle,
} from "../lib/analytics";

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

const TYPEWRITER_PHRASES = [
    "¿Qué te gustaría hacer hoy en San Pedro Cholula?",
    "Busca restaurantes, hoteles, experiencias...",
    "Encuentra a los mejores guías certificados...",
    "Descubre la zona arqueológica y museos..."
];

/* ═══════════════════════════════════════════════════════════
   Componente principal
═══════════════════════════════════════════════════════════ */
export default function SearchBar({
    placeholder = "¿Qué te gustaría hacer hoy en San Pedro Cholula?",
    items = [],
}: SearchBarProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchableItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const [openNow, setOpenNow] = useState(false);
    const [typedPlaceholder, setTypedPlaceholder] = useState("");
    
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Efecto de máquina de escribir para el placeholder
    useEffect(() => {
        let currentPhraseIndex = 0;
        let currentCharIndex = 0;
        let isDeleting = false;
        let timeoutId: ReturnType<typeof setTimeout>;

        const type = () => {
            const currentPhrase = TYPEWRITER_PHRASES[currentPhraseIndex];
            
            if (isDeleting) {
                setTypedPlaceholder(currentPhrase.substring(0, currentCharIndex - 1));
                currentCharIndex--;
            } else {
                setTypedPlaceholder(currentPhrase.substring(0, currentCharIndex + 1));
                currentCharIndex++;
            }

            let typeSpeed = isDeleting ? 30 : 70;

            if (!isDeleting && currentCharIndex === currentPhrase.length) {
                // Pausa al terminar de escribir la frase
                typeSpeed = 2000;
                isDeleting = true;
            } else if (isDeleting && currentCharIndex === 0) {
                isDeleting = false;
                currentPhraseIndex = (currentPhraseIndex + 1) % TYPEWRITER_PHRASES.length;
                typeSpeed = 500;
            }

            timeoutId = setTimeout(type, typeSpeed);
        };

        timeoutId = setTimeout(type, 500);

        return () => clearTimeout(timeoutId);
    }, []);

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
                    // Emitir evento con query vacío → mostrar todo
                    document.dispatchEvent(
                        new CustomEvent("portal:search", { detail: { query: "" } })
                    );
                    return;
                }

                let found: SearchableItem[] = [];

                if (norm === "experiencias" || norm === "experiencia" || norm === "que hacer" || norm === "quehacer") {
                    found = items.filter(item => item.category === "Experiencia" || item.category === "Destino");
                } else if (norm === "restaurantes" || norm === "restaurante" || norm === "comer") {
                    found = items.filter(item => item.category === "Restaurante");
                } else if (norm === "hoteles" || norm === "hotel" || norm === "dormir") {
                    found = items.filter(item => item.category === "Hotel");
                } else if (norm === "guias" || norm === "guia" || norm === "guias turisticos") {
                    found = items.filter(item => item.category === "Guia");
                } else {
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

                    found = scoredItems
                        .filter(x => x.score > 0)
                        .sort((a, b) => b.score - a.score)
                        .map(x => x.item);
                }

                setResults(found);
                setIsOpen(true);

                // Tracking GA4: registrar la búsqueda con el conteo de resultados
                trackSearch(q.trim(), found.length);

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

        // Tracking GA4: registrar el clic en el resultado
        trackResultClick(item.label, item.category);

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

    const showDropdown = isOpen;

    // Renderizador de los 4 atajos de categoría
    const renderShortcutsRow = (inDropdown = false) => (
        <div className={`search-shortcuts-row ${inDropdown ? 'search-shortcuts-row--dropdown' : ''}`}>
            {/* Comer – cubiertos */}
            <button
                type="button"
                className="search-pill-btn search-pill-btn--comer"
                onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery("restaurantes");
                    setIsOpen(true);
                    inputRef.current?.focus();
                    trackShortcutClick("Comer");
                }}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M3 2v4c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2" />
                    <path d="M7 2v20" />
                    <path d="M21 2v6.5c0 1.4-1.1 2.5-2.5 2.5S16 9.9 16 8.5V2" />
                    <path d="M18.5 11V22" />
                </svg>
                <span>Comer</span>
            </button>

            {/* Dormir – cama */}
            <button
                type="button"
                className="search-pill-btn search-pill-btn--dormir"
                onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery("hoteles");
                    setIsOpen(true);
                    inputRef.current?.focus();
                    trackShortcutClick("Dormir");
                }}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M3 7v11" />
                    <path d="M21 7v11" />
                    <path d="M3 11h18" />
                    <path d="M3 18h18" />
                    <rect x="7" y="7" width="4" height="4" rx="1" />
                </svg>
                <span>Dormir</span>
            </button>

            {/* Qué hacer / Experiencias – volcán/montaña */}
            <button
                type="button"
                className="search-pill-btn search-pill-btn--quehacer"
                onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery("experiencias");
                    setIsOpen(true);
                    inputRef.current?.focus();
                    trackShortcutClick("Experiencias");
                }}
            >
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="18" height="18">
                    <path d="M12 3 L22 20 H2 Z" />
                </svg>
                <span>Experiencias</span>
            </button>

            {/* Guías Certificados – credencial/badge */}
            <button
                type="button"
                className="search-pill-btn search-pill-btn--guias"
                onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery("guias");
                    setIsOpen(true);
                    inputRef.current?.focus();
                    trackShortcutClick("Guías Certificados");
                }}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <rect x="2" y="4" width="20" height="16" rx="3" />
                    <circle cx="9" cy="10" r="2.5" />
                    <path d="M5 18c0-2.2 1.8-4 4-4s4 1.8 4 4" />
                    <path d="M15 8h4" />
                    <path d="M15 12h4" />
                </svg>
                <span>Guías Certificados</span>
            </button>
        </div>
    );

    return (
        <div ref={containerRef} className={`search-container${showDropdown ? ' search-dropdown-open' : ''}`}>
            {/* ── Barra de búsqueda ── */}
            <div className={`search-input-wrapper ${focused ? "focused" : ""}`}>

                {/* Fila 1: input + botón buscar */}
                <div className="search-input-row">
                    {/* Icono lupa – siempre gris neutro */}
                    <svg
                        className="search-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#4B5563"
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
                            setIsOpen(true);
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
                        placeholder={typedPlaceholder || placeholder}
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

                    {/* Botón Buscar */}
                    <button
                        type="button"
                        className="search-submit-btn"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            if (query.trim()) {
                                search(query);
                                setIsOpen(true);
                            } else {
                                setIsOpen(true);
                                inputRef.current?.focus();
                            }
                        }}
                    >
                        Buscar →
                    </button>
                </div>

                {/* Fila 2: 4 atajos de categoría (solo visibles cuando el dropdown NO está desplegado) */}
                {!showDropdown && renderShortcutsRow(false)}
            </div>

            {/* ── Dropdown unificado ── */}
            {showDropdown && (
                <div
                    className="search-dropdown"
                    role="listbox"
                    aria-label="Resultados de búsqueda"
                >
                    {/* Atajos de categoría integrados dentro del dropdown */}
                    {renderShortcutsRow(true)}

                    {/* Chip "Abiertos ahora" dentro del dropdown */}
                    <div className="search-filter-row">
                        <button
                            className={`search-filter-chip ${openNow ? "search-filter-chip--active" : ""}`}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                const next = !openNow;
                                setOpenNow(next);
                                trackFilterToggle(next);
                            }}
                        >
                            <span className={`search-filter-dot ${openNow ? "search-filter-dot--on" : ""}`} />
                            Abiertos ahora
                        </button>
                    </div>

                    {(!query.trim() && !openNow) ? (
                        <div className="search-suggestions">
                            <p className="search-suggestions-title">Sugerencias de búsqueda</p>
                            <div className="search-suggestions-list">
                                {([
                                    {
                                        label: "quiero lugares con pizza",
                                        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="15" height="15"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                                    },
                                    {
                                        label: "dónde comer comida mexicana",
                                        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="15" height="15"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" /></svg>
                                    },
                                    {
                                        label: "hoteles cerca del centro",
                                        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="15" height="15"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" /><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" /><path d="M12 4v6" /><path d="M2 18h20" /></svg>
                                    },
                                    {
                                        label: "cafeterías con terraza",
                                        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="15" height="15"><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" /><line x1="6" y1="2" x2="6" y2="4" /><line x1="10" y1="2" x2="10" y2="4" /><line x1="14" y1="2" x2="14" y2="4" /></svg>
                                    },
                                    {
                                        label: "dónde comer comida italiana",
                                        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="15" height="15"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" /></svg>
                                    },
                                    {
                                        label: "hoteles con jardín",
                                        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="15" height="15"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" /><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" /><path d="M12 4v6" /><path d="M2 18h20" /></svg>
                                    },
                                    {
                                        label: "dónde comer comida poblana",
                                        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="15" height="15"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                                    },
                                    {
                                        label: "sitios históricos cholula",
                                        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="15" height="15"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                    },
                                    {
                                        label: "bares y vida nocturna",
                                        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="15" height="15"><path d="M8 22h8" /><path d="M7 10h10" /><path d="m12 10 2-8H10l2 8" /><path d="M12 10v12" /></svg>
                                    },
                                ] as { label: string; icon: React.ReactNode }[]).map(({ label, icon }) => (
                                    <button
                                        key={label}
                                        className="search-suggestion-btn"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            setQuery(label);
                                        }}
                                    >
                                        <span className="search-suggestion-icon">{icon}</span>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : displayItems.length === 0 ? (
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
                                        <span className="search-category-title">{cat === "Experiencia" ? "Experiencias" : cat === "Guia" ? "Guías" : `${cat}s`}</span>
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
