/**
 * Diccionario de strings de interfaz.
 *
 * Aquí va solo el "chrome" del sitio: navegación, botones, etiquetas, estados.
 * El contenido editorial (imperdibles, itinerarios, fichas de negocios) NO vive
 * aquí — son datos, y se traducen en sus propios archivos.
 *
 * `Strings` está declarado explícitamente a propósito: si falta una clave en un
 * idioma, el build falla en vez de mostrar un hueco en producción.
 *
 * Las islas de React no importan este módulo: reciben ya resuelto el bloque que
 * necesitan (`getStrings(lang).search`), así el cliente no descarga los dos idiomas.
 */
import { DEFAULT_LOCALE, type Locale } from "./config";

type NavKey = "home" | "lodging" | "food" | "things" | "guides";

export interface Strings {
	site: { description: string };
	a11y: { whatsapp: string; mainNav: string; mobileNav: string };
	/** Navegación de escritorio (header). */
	nav: Record<NavKey, string>;
	/** Navegación inferior de móvil: etiquetas más cortas. */
	bottomNav: Record<NavKey, string>;
	footer: {
		contactTitle: string;
		socialTitle: string;
		shareTitle: string;
		privacy: string;
		shareOn: string;
		shareByEmail: string;
	};
	card: {
		chips: {
			petFriendly: string;
			pool: string;
			spa: string;
			terrace: string;
			reception24h: string;
			liveMusic: string;
		};
		accreditation: string;
		specialization: string;
		languages: string;
		seeMore: string;
		seeLess: string;
		viewLocation: string;
	};
	search: {
		placeholder: string;
		typewriter: string[];
		submit: string;
		ariaSearch: string;
		ariaClear: string;
		ariaResults: string;
		/** Etiqueta y consulta de cada atajo. La consulta se escribe en el input. */
		shortcuts: Record<"food" | "lodging" | "things" | "guides", { label: string; query: string }>;
		/**
		 * Términos que, escritos tal cual, filtran por categoría en vez de buscar
		 * por texto. Van normalizados: minúsculas y sin acentos.
		 */
		aliases: Record<"food" | "lodging" | "things" | "guides", string[]>;
		openNow: string;
		suggestionsTitle: string;
		suggestions: string[];
		emptyClosed: string;
		emptyNoResultsOpen: string;
		emptyNoResults: string;
		emptyHint: string;
		open: string;
		closed: string;
		/** Título de cada grupo de resultados, por categoría interna. */
		groups: Record<string, string>;
		/** Palabra que acompaña a la calificación en el índice ("4 estrellas"). */
		starsKeyword: string;
	};
	filter: { all: string };
	carousel: {
		title: string;
		viewFull: string;
		ariaViewFull: string;
		ariaDots: string;
		ariaPrev: string;
		ariaNext: string;
		ariaClose: string;
	};
}

const es: Strings = {
	site: {
		description:
			"Descubre la magia de Cholula, el corazón de México. Hoteles, restaurantes, qué hacer y guías turísticos certificados en San Pedro Cholula, Pueblo Mágico de Puebla.",
	},
	a11y: {
		whatsapp: "Contactar por WhatsApp",
		mainNav: "Navegación principal",
		mobileNav: "Navegación principal móvil",
	},
	nav: {
		home: "Cholula",
		lodging: "Dónde hospedarse",
		food: "Dónde comer",
		things: "Qué hacer",
		guides: "Guías Turísticos",
	},
	bottomNav: {
		home: "Explora",
		lodging: "Hoteles",
		food: "Cocina",
		things: "Qué Hacer",
		guides: "Guías",
	},
	footer: {
		contactTitle: "Dirección de Turismo y Contacto",
		socialTitle: "Síguenos en nuestras redes sociales",
		shareTitle: "Comparte nuestra página en:",
		privacy: "Aviso de privacidad",
		shareOn: "Compartir en",
		shareByEmail: "Compartir por Email",
	},
	card: {
		chips: {
			petFriendly: "Pet friendly",
			pool: "Alberca",
			spa: "Spa",
			terrace: "Terraza",
			reception24h: "Recepción 24h",
			liveMusic: "Música en vivo",
		},
		accreditation: "Acreditación:",
		specialization: "Especialización:",
		languages: "Idiomas:",
		seeMore: "Ver más",
		seeLess: "Ver menos",
		viewLocation: "VER UBICACIÓN",
	},
	search: {
		placeholder: "¿Qué te gustaría hacer hoy en San Pedro Cholula?",
		typewriter: [
			"¿Qué te gustaría hacer hoy en San Pedro Cholula?",
			"Busca restaurantes, hoteles, experiencias...",
			"Encuentra a los mejores guías certificados...",
			"Descubre la zona arqueológica y museos...",
		],
		submit: "Buscar →",
		ariaSearch: "Buscar",
		ariaClear: "Limpiar búsqueda",
		ariaResults: "Resultados de búsqueda",
		shortcuts: {
			food: { label: "Comer", query: "restaurantes" },
			lodging: { label: "Dormir", query: "hoteles" },
			things: { label: "Experiencias", query: "experiencias" },
			guides: { label: "Guías Certificados", query: "guias" },
		},
		aliases: {
			food: ["restaurantes", "restaurante", "comer"],
			lodging: ["hoteles", "hotel", "dormir"],
			things: ["experiencias", "experiencia", "que hacer", "quehacer"],
			guides: ["guias", "guia", "guias turisticos"],
		},
		openNow: "Abiertos ahora",
		suggestionsTitle: "Sugerencias de búsqueda",
		suggestions: [
			"quiero lugares con pizza",
			"dónde comer comida mexicana",
			"hoteles cerca del centro",
			"cafeterías con terraza",
			"dónde comer comida italiana",
			"hoteles con jardín",
			"dónde comer comida poblana",
			"sitios históricos cholula",
			"bares y vida nocturna",
		],
		emptyClosed: "Ningún establecimiento abierto en este momento",
		emptyNoResultsOpen: "Sin resultados abiertos para",
		emptyNoResults: "Sin resultados para",
		emptyHint: "Intenta con otro término",
		open: "Abierto",
		closed: "Cerrado",
		groups: {
			Hotel: "Hoteles",
			Restaurante: "Restaurantes",
			Experiencia: "Experiencias",
			Guia: "Guías",
		},
		starsKeyword: "estrellas",
	},
	filter: { all: "Todas las categorías" },
	carousel: {
		title: "Como te lo recomendaría un local",
		viewFull: "Ver completa",
		ariaViewFull: "Ver foto completa",
		ariaDots: "Navegación de imperdibles",
		ariaPrev: "Anterior",
		ariaNext: "Siguiente",
		ariaClose: "Cerrar foto",
	},
};

const en: Strings = {
	site: {
		description:
			"Discover the magic of Cholula, the heart of Mexico. Hotels, restaurants, things to do and certified tour guides in San Pedro Cholula, a Pueblo Mágico in Puebla.",
	},
	a11y: {
		whatsapp: "Contact us on WhatsApp",
		mainNav: "Main navigation",
		mobileNav: "Mobile main navigation",
	},
	nav: {
		home: "Cholula",
		lodging: "Where to stay",
		food: "Where to eat",
		things: "Things to do",
		guides: "Tour Guides",
	},
	bottomNav: {
		home: "Explore",
		lodging: "Hotels",
		food: "Food",
		things: "To Do",
		guides: "Guides",
	},
	footer: {
		contactTitle: "Tourism Office and Contact",
		socialTitle: "Follow us on social media",
		shareTitle: "Share our site on:",
		privacy: "Privacy notice",
		shareOn: "Share on",
		shareByEmail: "Share by email",
	},
	card: {
		chips: {
			petFriendly: "Pet friendly",
			pool: "Pool",
			spa: "Spa",
			terrace: "Terrace",
			reception24h: "24h reception",
			liveMusic: "Live music",
		},
		accreditation: "Accreditation:",
		specialization: "Specialization:",
		languages: "Languages:",
		seeMore: "See more",
		seeLess: "See less",
		viewLocation: "VIEW LOCATION",
	},
	search: {
		placeholder: "What would you like to do today in San Pedro Cholula?",
		typewriter: [
			"What would you like to do today in San Pedro Cholula?",
			"Search restaurants, hotels, experiences...",
			"Find the best certified tour guides...",
			"Discover the archaeological site and museums...",
		],
		submit: "Search →",
		ariaSearch: "Search",
		ariaClear: "Clear search",
		ariaResults: "Search results",
		shortcuts: {
			food: { label: "Eat", query: "restaurants" },
			lodging: { label: "Sleep", query: "hotels" },
			things: { label: "Experiences", query: "experiences" },
			guides: { label: "Certified Guides", query: "guides" },
		},
		aliases: {
			food: ["restaurants", "restaurant", "eat", "food", "where to eat"],
			lodging: ["hotels", "hotel", "sleep", "stay", "where to stay"],
			things: ["experiences", "experience", "things to do", "what to do"],
			guides: ["guides", "guide", "tour guides"],
		},
		openNow: "Open now",
		suggestionsTitle: "Search suggestions",
		suggestions: [
			"places with pizza",
			"where to eat mexican food",
			"hotels near downtown",
			"cafes with a terrace",
			"where to eat italian food",
			"hotels with a garden",
			"where to eat poblano food",
			"historic sites in cholula",
			"bars and nightlife",
		],
		emptyClosed: "No places are open right now",
		emptyNoResultsOpen: "No open results for",
		emptyNoResults: "No results for",
		emptyHint: "Try another term",
		open: "Open",
		closed: "Closed",
		groups: {
			Hotel: "Hotels",
			Restaurante: "Restaurants",
			Experiencia: "Experiences",
			Guia: "Guides",
		},
		starsKeyword: "stars",
	},
	filter: { all: "All categories" },
	carousel: {
		title: "As a local would recommend it",
		viewFull: "View full",
		ariaViewFull: "View full photo",
		ariaDots: "Highlights navigation",
		ariaPrev: "Previous",
		ariaNext: "Next",
		ariaClose: "Close photo",
	},
};

const STRINGS: Record<Locale, Strings> = { es, en };

export function getStrings(locale: Locale): Strings {
	return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}
