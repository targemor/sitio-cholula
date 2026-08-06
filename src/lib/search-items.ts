/**
 * Índice de búsqueda que se inyecta en la isla `SearchBar`.
 *
 * `category` es una **clave interna** (`"Hotel"`, `"Restaurante"`, `"Experiencia"`,
 * `"Guia"`): la usa el buscador para agrupar y filtrar, así que nunca se traduce.
 * Lo que se traduce es su etiqueta visible, que vive en `ui.ts` (`search.groups`).
 *
 * `id` es el índice dentro de su array en cholula.json. El enlace profundo
 * `/donde-comer?id=3` depende de que ese orden no cambie entre idiomas: por eso
 * `getBusinesses` traduce los valores en sitio y nunca reordena ni filtra.
 */
import type { Locale } from "../i18n/config";
import { localizePathSafe } from "../i18n/routes";
import { getStrings } from "../i18n/ui";
import { getBusinesses } from "./business-data";
import { formatHorarioDetalle } from "./horario";

export function buildSearchItems(locale: Locale) {
	const t = getStrings(locale).search;
	const href = {
		lodging: localizePathSafe("lodging", locale),
		food: localizePathSafe("food", locale),
		things: localizePathSafe("things", locale),
		guides: localizePathSafe("guides", locale),
	};

	const hoteles = getBusinesses("hoteles", locale);
	const restaurantes = getBusinesses("restaurantes", locale);
	const queHacer = getBusinesses("queHacer", locale);
	const guias = getBusinesses("guiasTuristicos", locale);

	return [
		...hoteles.map((item: any, i) => {
			const estrellasText = item.estrellas
				? `${item.estrellas} ${t.starsKeyword}`
				: "";
			return {
				id: i,
				label: item.nombre,
				category: "Hotel",
				href: href.lodging,
				sublabel: "",
				searchKeywords: [
					estrellasText,
					item.zona,
					item.distanciaGranPiramide,
					item.categoriaPrecio,
					// Los campos Sí/No ya son booleanos y no aportan nada al índice: antes
					// solo inyectaban tokens "Sí"/"No". El matiz sí es texto buscable.
					item.aceptaMascotasNota,
					item.terrazaNota,
					item.categoria,
					item.amenidades,
					item.tamanioCategoria,
					item.perfilIdeal,
				]
					.filter(Boolean)
					.join(" "),
				rating: item.estrellas || 0,
				horario: item.horario,
			};
		}),
		...restaurantes.map((item: any, i) => ({
			id: i,
			label: item.nombre,
			category: "Restaurante",
			href: href.food,
			sublabel: [item.tipoComida, item.ambiente, item.caracteristicasEspeciales]
				.filter(Boolean)
				.join(" • "),
			searchKeywords: [
				item.clasificacion,
				item.dondeEsta,
				item.tipoComida,
				item.ambiente,
				item.caracteristicasEspeciales,
				item.idealPara,
				formatHorarioDetalle(item.horario, locale),
				item.zona,
				item.categoriaPrecio,
				item.precioPpMxn,
				item.ocasionIdeal,
				item.perfilIdeal,
				item.espacioFisico,
			]
				.filter(Boolean)
				.join(" "),
			horario: item.horario,
		})),
		...queHacer.map((item: any, i) => ({
			id: i,
			label: item.nombre,
			category: "Experiencia",
			href: href.things,
			sublabel: item.tipo || "",
			searchKeywords: [
				item.tipo,
				item.descripcion,
				// Mismos alias que reconoce el buscador al escribirlos.
				...t.aliases.things,
			]
				.filter(Boolean)
				.join(" "),
			horario: item.horario,
		})),
		...guias.map((item: any, i) => ({
			id: i,
			label: item.nombre,
			category: "Guia",
			href: href.guides,
			sublabel: item.paginaFacebook || "",
			horario: item.horario,
		})),
	];
}
