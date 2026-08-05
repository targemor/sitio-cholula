/**
 * analytics.ts — Visit Cholula
 * Módulo centralizado de Google Analytics 4.
 *
 * ⚠️  Reemplaza "G-XXXXXXXXXX" con tu Measurement ID real de GA4.
 *     Google Analytics → Admin → Flujos de datos → tu sitio → Measurement ID
 */

export const GA_MEASUREMENT_ID = "G-XXXXXXXXXX";

/* ─── Tipos ──────────────────────────────────────────────────── */

type GtagCommand = "config" | "event" | "js" | "set";

interface GtagEventParams {
  [key: string]: string | number | boolean | undefined;
}

/* ─── Acceso seguro a gtag ───────────────────────────────────── */

function gtag(command: GtagCommand, ...args: unknown[]): void {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (typeof w.gtag !== "function") return;
  w.gtag(command, ...args);
}

/* ─── Eventos personalizados ─────────────────────────────────── */

/**
 * Búsqueda en la SearchBar.
 * Se dispara cuando el usuario termina de escribir (después del debounce).
 */
export function trackSearch(searchTerm: string, resultsCount: number): void {
  if (!searchTerm.trim()) return;
  gtag("event", "search", {
    search_term: searchTerm,
    results_count: resultsCount,
  });
}

/**
 * Clic en un resultado de la búsqueda.
 * Registra qué ítem seleccionó y de qué categoría.
 */
export function trackResultClick(
  itemName: string,
  category: string
): void {
  gtag("event", "select_content", {
    content_type: category,
    item_id: itemName,
  });
}

/**
 * Clic en una píldora de categoría (Comer / Dormir / Experiencias / Guías).
 */
export function trackShortcutClick(category: string): void {
  gtag("event", "shortcut_click", {
    category,
  });
}

/**
 * Toggle del filtro "Abiertos ahora".
 */
export function trackFilterToggle(active: boolean): void {
  gtag("event", "filter_toggle", {
    filter_name: "open_now",
    active,
  });
}

/**
 * Clic en una card de "Visítanos" (Hoteles, Restaurantes, Experiencias, Guías).
 */
export function trackNavigationClick(destination: string): void {
  gtag("event", "navigation_click", {
    destination,
  });
}

/**
 * Clic en una card de Imperdibles (navegación manual o arrow).
 */
export function trackImperdibleView(itemName: string, category: string): void {
  gtag("event", "view_item", {
    item_name: itemName,
    item_category: category,
  });
}

/**
 * Clic en el botón de WhatsApp flotante.
 */
export function trackWhatsAppClick(): void {
  gtag("event", "whatsapp_click", {
    event_category: "contact",
    event_label: "fab",
  });
}

/**
 * Clic en un enlace externo (Maps, Instagram, etc.).
 */
export function trackExternalLink(url: string): void {
  try {
    const domain = new URL(url).hostname;
    gtag("event", "click", {
      event_category: "outbound",
      event_label: url,
      link_domain: domain,
      link_url: url,
    });
  } catch {
    // URL inválida — ignorar silenciosamente
  }
}

/**
 * Cambio de tab en el componente ItinerarioTabs.
 */
export function trackItineraryTab(tabLabel: string): void {
  gtag("event", "itinerary_tab_click", {
    tab_label: tabLabel,
  });
}

/**
 * Profundidad de scroll (25%, 50%, 75%, 100%).
 * Llama a esta función desde el script global del Layout.
 */
export function trackScrollDepth(depthPercent: number): void {
  gtag("event", "scroll", {
    percent_scrolled: depthPercent,
  });
}
