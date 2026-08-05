/**
 * JSON-LD del home. Compartido por `/` y `/en/`: solo cambian los textos, la
 * URL y el `inLanguage`.
 */
import { LOCALE_TAGS, type Locale } from "../i18n/config";
import { localizePath } from "../i18n/routes";
import { getPageCopy } from "../i18n/pages";

const SITE_URL = "https://visitcholula.mx";

export function buildHomeSchemas(locale: Locale): object[] {
	const copy = getPageCopy(locale).home;
	const homeUrl = `${SITE_URL}${localizePath("home", locale)}`;

	const touristDestination = {
		"@context": "https://schema.org",
		"@type": "TouristDestination",
		name: "San Pedro Cholula",
		alternateName: ["Cholula", "Visit Cholula", "Cholula Pueblo Mágico"],
		description: copy.schema.destinationDesc,
		url: SITE_URL,
		image: `${SITE_URL}/hero-poster.webp`,
		geo: {
			"@type": "GeoCoordinates",
			latitude: 19.0547,
			longitude: -98.3018,
		},
		containedInPlace: {
			"@type": "State",
			name: "Puebla",
			containedInPlace: {
				"@type": "Country",
				name: "México",
			},
		},
		touristType: copy.schema.touristType,
		hasMap: "https://www.google.com/maps/place/San+Pedro+Cholula,+Pue.",
	};

	const webSite = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "Visit Cholula",
		url: SITE_URL,
		description: copy.schema.siteDesc,
		inLanguage: LOCALE_TAGS[locale],
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${homeUrl}?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
	};

	const organization = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: "Visit Cholula",
		url: SITE_URL,
		logo: `${SITE_URL}/logo_guia_cholula_2025.webp`,
		contactPoint: {
			"@type": "ContactPoint",
			telephone: "+52-222-102-9059",
			contactType: "tourist information",
			// Dato de hecho sobre el equipo de atención, no texto de interfaz.
			availableLanguage: "Spanish",
		},
		areaServed: {
			"@type": "City",
			name: "San Pedro Cholula",
		},
	};

	return [touristDestination, webSite, organization];
}
