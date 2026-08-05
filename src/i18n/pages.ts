/**
 * Copy propio de cada página: encabezados, kickers y metadatos SEO.
 *
 * Se separa de `ui.ts` a propósito: aquello es chrome reutilizable (botones,
 * navegación, estados), esto es texto que aparece una sola vez, en una página
 * concreta. Y se separa de `src/data/`: esos son registros de contenido
 * (imperdibles, negocios), no prosa de plantilla.
 *
 * Como en `ui.ts`, la interfaz es explícita para que falte una clave rompa el
 * build en vez de dejar un hueco.
 */
import { DEFAULT_LOCALE, type Locale } from "./config";

interface Stat {
	icon: string;
	num: string;
	unit: string;
	desc: string;
	/** Fuente del dato, en su propio renglón. */
	note?: string;
}

export interface PageCopy {
	home: {
		seoTitle: string;
		seoDesc: string;
		search: { title: string; subtitle: string };
		piramide: {
			titleBefore: string;
			titleHighlight: string;
			subtitle: string;
			ctaPrimary: string;
			ctaSecondary: string;
			photoBy: string;
		};
		stats: Stat[];
		visitanos: { kicker: string; title: string };
		itinerarios: { kicker: string; title: string };
		mapa: { iframeTitle: string; croquisAlt: string };
		eventos: { kicker: string; title: string };
		artesanias: { kicker: string; title: string; subtitle: string };
		/** Textos que van dentro del JSON-LD. */
		schema: {
			destinationDesc: string;
			touristType: string[];
			siteDesc: string;
		};
	};
	privacy: { seoTitle: string };
}

const es: PageCopy = {
	home: {
		seoTitle: "Inicio — San Pedro Cholula, Pueblo Mágico",
		seoDesc:
			"Descubre Cholula, la ciudad más antigua de América. Hoteles, restaurantes, guías turísticos certificados y todo lo que necesitas para visitar San Pedro Cholula, Pueblo Mágico de Puebla.",
		search: {
			title: "¿Qué te gustaría vivir hoy?",
			subtitle: "Cuéntanos qué buscas y te lo mostramos al instante",
		},
		piramide: {
			titleBefore: "Tenemos la pirámide con la base ",
			titleHighlight: "más grande del mundo",
			subtitle:
				"Una iglesia en la cima, una pirámide bajo tus pies y el Popocatépetl de testigo.",
			ctaPrimary: "Planea tu visita",
			ctaSecondary: "Ver los imperdibles →",
			photoBy: "Foto:",
		},
		stats: [
			{
				icon: "🏛️",
				num: "2,500",
				unit: "AÑOS",
				desc: "Ciudad viva más antigua del continente",
			},
			{
				icon: "🌎",
				num: "+1M",
				unit: "AL AÑO",
				desc: "Visitantes cada año",
				note: "(DATATUR, 2025)",
			},
			{
				icon: "🌽",
				num: "500",
				unit: "AÑOS",
				desc: "El trueque más antiguo de América",
			},
		],
		visitanos: { kicker: "EXPLORA CHOLULA", title: "Visítanos" },
		itinerarios: { kicker: "PLANEA TU VISITA", title: "¿Cuánto tiempo tienes?" },
		mapa: {
			iframeTitle: "Mapa de Cholula",
			croquisAlt: "Croquis turístico de Cholula",
		},
		eventos: { kicker: "CARTELERA Y FESTIVIDADES", title: "Eventos" },
		artesanias: {
			kicker: "HECHO EN CHOLULA",
			title: "Artesanías de Cholula",
			subtitle: "El recuerdo que más vale la pena, hecho por manos cholultecas.",
		},
		schema: {
			destinationDesc:
				"Cholula es la ciudad viva más antigua de América, habitada sin pausa desde el año 500 a.C. Posee la base de pirámide más grande del mundo, más de 365 iglesias y una vibrante escena gastronómica y hotelera.",
			touristType: [
				"Turistas culturales",
				"Turistas gastronómicos",
				"Familias",
				"Mochileros",
			],
			siteDesc:
				"Guía turística oficial de San Pedro Cholula, Pueblo Mágico de Puebla, México.",
		},
	},
	privacy: { seoTitle: "Aviso de Privacidad" },
};

const en: PageCopy = {
	home: {
		seoTitle: "Home — San Pedro Cholula, Pueblo Mágico",
		seoDesc:
			"Discover Cholula, the oldest continuously inhabited city in the Americas. Hotels, restaurants, certified tour guides and everything you need to visit San Pedro Cholula, a Pueblo Mágico in Puebla.",
		search: {
			title: "What would you like to experience today?",
			subtitle: "Tell us what you're looking for and we'll show you right away",
		},
		piramide: {
			titleBefore: "We have the pyramid with the ",
			titleHighlight: "largest base in the world",
			subtitle:
				"A church at the summit, a pyramid beneath your feet and Popocatépetl as your witness.",
			ctaPrimary: "Plan your visit",
			ctaSecondary: "See the highlights →",
			photoBy: "Photo:",
		},
		stats: [
			{
				icon: "🏛️",
				num: "2,500",
				unit: "YEARS",
				desc: "Oldest living city on the continent",
			},
			{
				icon: "🌎",
				num: "+1M",
				unit: "PER YEAR",
				desc: "Visitors every year",
				note: "(DATATUR, 2025)",
			},
			{
				icon: "🌽",
				num: "500",
				unit: "YEARS",
				desc: "The oldest barter market in the Americas",
			},
		],
		visitanos: { kicker: "EXPLORE CHOLULA", title: "Visit us" },
		itinerarios: { kicker: "PLAN YOUR VISIT", title: "How much time do you have?" },
		mapa: {
			iframeTitle: "Map of Cholula",
			croquisAlt: "Tourist map of Cholula",
		},
		eventos: { kicker: "WHAT'S ON AND FESTIVALS", title: "Events" },
		artesanias: {
			kicker: "MADE IN CHOLULA",
			title: "Cholula Handicrafts",
			subtitle: "The souvenir most worth taking home, made by cholulteca hands.",
		},
		schema: {
			destinationDesc:
				"Cholula is the oldest continuously inhabited city in the Americas, lived in without pause since 500 BC. It has the largest pyramid base in the world, more than 365 churches and a vibrant food and hotel scene.",
			touristType: [
				"Cultural tourists",
				"Food tourists",
				"Families",
				"Backpackers",
			],
			siteDesc:
				"Official tourism guide to San Pedro Cholula, a Pueblo Mágico in Puebla, Mexico.",
		},
	},
	privacy: { seoTitle: "Privacy Notice" },
};

const PAGES: Record<Locale, PageCopy> = { es, en };

export function getPageCopy(locale: Locale): PageCopy {
	return PAGES[locale] ?? PAGES[DEFAULT_LOCALE];
}
