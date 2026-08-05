# Plan de implementación i18n — visitcholula.mx

Objetivo: español (actual, sin cambios de URL) + inglés en `/en/`, con SEO correcto
y sin regresiones en el sitio ya indexado.

---

## Decisiones de arquitectura

| Decisión | Elección | Por qué |
|---|---|---|
| Enrutado | Astro i18n nativo, `prefixDefaultLocale: false` | ES se queda en `/donde-comer` (ya indexado, GA4 histórico intacto). EN vive en `/en/where-to-eat`. |
| UI / chrome | Diccionario de claves `src/i18n/ui.ts` | Pocos strings, muy reutilizados. |
| Contenido editorial | Archivos paralelos por idioma | Es prosa, no interfaz. Las claves estorban. |
| Datos de negocios | **Overlay** `cholula.en.json` indexado por `nombre` | No duplica los 104 KB de teléfonos/URLs/galerías. Si se agrega un hotel en ES y falta la traducción, cae a ES en vez de romper. Preserva el orden del array (crítico: ver "Deep links"). |
| Enums de datos | Mapa `es → en` compartido | 18 campos con ≤9 valores únicos cubren ~1,100 apariciones con 81 traducciones. |
| Horarios | Generados en build, no traducidos | Elimina 126 strings largos pre-formateados. |
| Fallback | Campo faltante en EN → valor en ES | Nunca una página rota ni un hueco en blanco. |

---

## Presupuesto real de traducción

Medido sobre el contenido actual, contando **strings únicos** (no apariciones):

| Bloque | Únicos | Notas |
|---|---:|---|
| UI / chrome | **91** | Header, BottomNav, Footer, SearchBar, BusinessCard, CategoryFilter, Layout, carrusel — ✅ hecho |
| Home editorial | **117** | 77 en `home.en.json` + ~40 de copy en `pages.ts` — ✅ hecho |
| Itinerarios | **87** | `itinerario.en.json` — ✅ hecho |
| Datos — enums | **69** ✅ | 13 campos: `zona`, `categoriaPrecio`, `aceptaMascotasNota`, `terrazaNota`, `tamanioCategoria`, `categoria`, `dondeEsta`, `tipo`, `descripcion`, `clasificacion`, `toursQueOfrece`, `idiomas`, `especializacion` |
| Datos — prosa | **297** ✅ | `perfilIdeal` (50), `idealPara` (37), `ocasionIdeal` (35), `etiquetasChatbot` (35), `tipoComida` (31), `caracteristicasEspeciales` (29), `ambiente` (26), `espacioFisico` (24), `amenidades` (15), `distanciaGranPiramide` (15) |
| Datos — booleanos | **0** | 162 valores Sí/No que ya no se traducen (ver Fase 0-bis) |
| Aviso de privacidad | traducido | ⚠️ traducción de cortesía, **sin revisión legal** — ✅ hecho |
| **Total** | **~697** | ✅ traducido |

Reducciones aplicables antes de traducir:
- `distanciaGranPiramide` (15 valores) sigue el patrón `"{n} min a pie de la Gran Pirámide"` → 1 plantilla + números.
- `amenidades` (15 valores, prom. 72 chars) son listas separadas por coma → tokenizar a ~20 términos únicos.
- `etiquetasChatbot` (35) es metadata interna de búsqueda: solo se traduce si quieres que el buscador funcione en inglés (Fase 5).

Con esas tres, el bloque de datos baja de 366 a **~270**.

---

## Fase 0-bis — Booleanos en el dato — ✅ HECHA

Los campos Sí/No dejaron de ser prosa en español dentro de `cholula.json`.

**Script:** `scripts/normalize-booleans.cjs` (`pnpm normalize-data`), idempotente y con
`--dry-run`. Va por **lista blanca** de 7 campos, nunca por patrón: en este dataset
`distanciaGranPiramide` (`"No caminable; aprox. 10 min en coche…"`) y
`caracteristicasEspeciales` (`"No acepta reservaciones"`) empiezan con "No" pero son prosa.

- 5 campos puros → `true`/`false`: `tieneAlberca`, `tieneSpa`, `recepcion24h`,
  `petFriendly`, `musicaEnVivo`.
- 2 campos con matiz → booleano + `<campo>Nota`: `aceptaMascotas`, `terraza`.
  `"Sí, vista a volcanes y pirámide"` → `terraza: true` + `terrazaNota: "vista a volcanes y pirámide"`.
- Resultado: **149 valores convertidos, 17 notas conservadas, 0 avisos.**
  (`certificacionSectur` y `clasificacionSectur` ya eran booleanos y no se tocaron.)

`pnpm extract` quedó encadenado al normalizador, para que regenerar desde WordPress no
reintroduzca los strings.

**UI:** cero conversión de string a booleano. `[slug].astro` pasa los campos tal cual y
`BusinessCard.astro` los recibe como `boolean` con default `false`. El helper intermedio
(`src/lib/business.ts`) se eliminó: la normalización vive solo en el script, que es su lugar.
En `index.astro` los `searchKeywords` cambiaron: los booleanos salieron del índice (solo
inyectaban tokens "Sí"/"No") y entraron `aceptaMascotasNota` y `terrazaNota`.

Con el helper fuera, la garantía de que el dato llegue booleano recae por completo en el
pipeline: `pnpm extract` encadena el normalizador. Si alguien edita `cholula.json` a mano y
escribe `"Sí"`, el chip se apaga en silencio — `pnpm normalize-data` lo arregla.

**Verificación:** 5 de las 6 páginas quedaron byte-idénticas; en `index.html` el único cambio
son los `searchKeywords`, y el diff a nivel de token es exactamente `"No"` ×91, `"Sí"` ×43,
`"Sí,"` ×15 fuera, más `"(costo"`→`"costo"` y `"hotel)"`→`"hotel"`. Ninguna palabra con
significado se perdió. Que `donde-hospedarse` y `donde-comer` sigan idénticas confirma que
los chips de las tarjetas se calculan igual que antes.

**Pendiente relacionado:** el campo `horario.resumen` (63 valores) es dato muerto — su único
consumidor era un fallback inalcanzable. Se puede borrar al tocar los datos en la Fase 4.

---

## Fase 0 — Refactors previos (bloqueante, sin cambio visible) — ✅ HECHA

Estos cuatro puntos **se rompen en silencio** al traducir. Hay que arreglarlos antes de
tocar i18n, y cada uno es verificable de inmediato porque el sitio en español no debe cambiar.

Archivo nuevo: `src/lib/horario.ts` (horarios independientes del idioma).

1. **`src/pages/[slug].astro:50`** — `const isRestaurantes = title === "DÓNDE COMER"`.
   El título se traduce; el filtro de clasificaciones desaparecería en `/en/`.
   → `const isRestaurantes = slug === "donde-comer"`.

2. **`src/components/BusinessCard.astro:99`** — `isYes()` hace `val.toLowerCase().startsWith("sí")`.
   Con datos en inglés (`"Yes"`) todos los chips (alberca, spa, recepción 24h, pet friendly,
   música en vivo) quedarían apagados.
   → Normalizar a booleano en la capa de datos, antes del render. El componente recibe `boolean`, no string.

3. **`src/components/SearchBar.tsx`** — `isCurrentlyOpen()` cae al `horario.resumen` en español
   y compara contra `"cerrado"`.
   → Parsear siempre los campos por día (`lunes`…`domingo`), que son numéricos y neutrales al idioma.

4. **`horario.resumen` / `horario.detalle`** — 126 strings pre-formateados en español
   (`"Lunes: 08:00-22:00 • Martes: ..."`).
   → Helper `formatHorario(horario, lang)` que los genera desde los campos por día.
   Traduces 7 nombres de día + `"cerrado"` en vez de 126 cadenas largas.

**Verificación de fase (ejecutada):**
- Build antes y después de los cambios → las **6 páginas HTML son byte-idénticas**
  (normalizando el `swiperId` aleatorio de `BusinessCard` y los hashes de assets).
- `isCurrentlyOpen`: 21,168 comparaciones (63 registros × 7 días × 48 franjas) contra la
  implementación original → **0 desacuerdos**.
- `formatHorarioDetalle`: reproduce el campo `detalle` de los 60 registros → **0 diferencias**.
- `isAffirmative`: 149 valores contra los dos predicados originales → **0 desacuerdos**.

Pendiente menor: el bundle CSS pasó de 106.2 KB a 107.2 KB. `scripts/purge-css.cjs` escanea
todos los `.ts` de `src/`, así que los dos archivos nuevos de `src/lib/` aportan tokens que
coinciden con clases del volcado de WordPress y evitan que se purguen. Se corrige excluyendo
`src/lib/**` del `content` de PurgeCSS (esos archivos no contienen nombres de clase).

---

## Fase 1 — Infraestructura — ✅ HECHA

```
src/i18n/
  config.ts      # locales, defaultLocale, etiquetas BCP-47/OG, DRAFT_LOCALES
  routes.ts      # ROUTES (slug por idioma), localizePath, getAlternates, IMPLEMENTED
  ui.ts          # diccionario UI: interfaz Strings explícita + getStrings(locale)
src/lib/
  directories.ts # config no-textual de las páginas de directorio
```

- **`astro.config.mjs`**: bloque `i18n` con `prefixDefaultLocale: false`; sitemap con
  `locales: { es, en }` y filtro que excluye `/en/` mientras la traducción esté a medias.
- **`Layout.astro`**: `lang` dinámico, `og:locale`, `hreflang` + `x-default`, canonical
  por idioma, `noindex` en idiomas borrador, `description` y aria-label desde el diccionario.
- **Navegación**: `Header.tsx` y `BottomNav.tsx` reciben `lang` y construyen sus destinos
  con `localizePathSafe`, que cae al español si la página aún no existe en ese idioma.
- **Selector de idioma**: vive dentro de `Header.tsx`, en un contenedor `.header-right`
  junto al nav. No podía ir *dentro* de `.header-nav` porque ese se oculta bajo 820px y
  desaparecería justo en móvil. Solo se renderiza si la página existe en el otro idioma.
- **Ruta de directorios**: `[slug].astro` → **`[...slug].astro`**. Los idiomas con prefijo
  ocupan dos segmentos (`/en/where-to-eat`), así que un `[slug]` de un solo segmento no
  los captura. Un solo archivo sirve ambos idiomas, sin duplicar markup.

⚠️ `getStaticPaths()` se hoistea fuera del scope del frontmatter: solo ve los `import`,
no los `const` del propio archivo. Por eso la config de directorios vive en `src/lib/`.

**Estado del inglés:** existen las 4 páginas de directorio. El home y el aviso de
privacidad se crean en las Fases 3 y 5; hasta entonces `IMPLEMENTED` los deja fuera de
`hreflang` y del selector, y los enlaces de nav caen al español.

Mapa de slugs:

| ES | EN |
|---|---|
| `/` | `/en/` |
| `donde-hospedarse` | `where-to-stay` |
| `donde-comer` | `where-to-eat` |
| `que-hacer` | `things-to-do` |
| `guias-turisticos` | `tour-guides` |
| `aviso-de-privacidad` | `privacy-notice` |

**Verificación de fase (ejecutada):**
- 10 páginas construidas: 6 ES + 4 EN.
- Texto visible de las páginas ES vs. el build previo: idéntico salvo la palabra
  "English" del selector en las 4 páginas que tienen contraparte.
- `hreflang` recíproco y `x-default` → español en todas las páginas con traducción.
- Las 4 páginas `/en/` salen con `noindex, follow`, `lang="en"`, `og:locale=en_US` y
  canonical propio.
- `sitemap-0.xml` contiene solo las 6 URLs en español.
- **0 enlaces internos rotos** en las 10 páginas (se revisaron todos los `href` internos
  contra la lista de rutas existentes).

Pendiente heredado, no introducido aquí: el sitemap emite `/donde-comer/` con barra final
y el canonical `/donde-comer` sin ella. Conviene unificarlo, pero ya era así antes.

---

## Fase 2 — Capa de UI — ✅ HECHA

**91 strings** extraídos a `src/i18n/ui.ts` (95 en inglés: 4 alias de búsqueda extra).

| Bloque | Strings |
|---|---:|
| `search` | 51 |
| `card` | 12 |
| `carousel` | 7 |
| `footer` | 6 |
| `nav` + `bottomNav` | 10 |
| `a11y` | 3 |
| `site`, `filter` | 2 |

`Strings` es una **interfaz explícita**, no un tipo inferido: si falta una clave en un
idioma el build falla, en vez de dejar un hueco en producción.

**Islas de React:** `Header`, `BottomNav` y `SearchBar` reciben el bloque ya resuelto
para su idioma (`labels={s.search}`), no el diccionario entero. El cliente nunca descarga
los dos idiomas. Cada isla conserva sus etiquetas en español como valor por defecto, para
que siga renderizando si alguien la usa sin props.

**Detalles que había que resolver:**

- Los `<script>` de `BusinessCard` y `CategoryFilter` se empaquetan aparte y no ven el
  frontmatter. Los textos que manipulan en runtime (`Ver más`/`Ver menos`, `Todas las
  categorías`) viajan en atributos `data-*`.
- Los atajos del buscador no podían quedarse como texto: `setQuery("restaurantes")`
  alimentaba un matcher que comparaba contra literales en español. Ahora cada atajo
  declara sus `aliases` por idioma, así que escribir "restaurants" en inglés filtra por
  categoría igual que "restaurantes" en español.
- Las etiquetas que se mandan a GA4 (`trackShortcutClick`) se quedan **fijas en español**
  a propósito: si cambiaran por idioma, el histórico de analítica se partiría en dos.
- Las sugerencias eran un array que mezclaba texto e icono. El texto pasó al diccionario
  y los iconos quedaron en `SUGGESTION_ICONS`, emparejados por posición.
- No se traducen: nombres de marca (`Cholula Pueblo Mágico`), los `aria-label` de los
  logos, ni `geo.placename`.

**Verificación (ejecutada):**
- Texto visible de las 6 páginas ES: **idéntico al build previo a la Fase 0**, salvo la
  palabra "English" del selector que introdujo la Fase 1. La Fase 2 no cambió ni un
  string del sitio en español.
- `/en/where-to-eat`: nav, bottom nav, footer, chips, "See more", "Privacy notice" y los
  15 `aria-label` en inglés.
- Prueba en navegador sobre el build real: la isla hidrata, el atajo por alias filtra por
  categoría, las 9 sugerencias renderizan con sus 9 iconos, las clases CSS de los atajos
  se conservan y **no hay errores en consola**.

**Hallazgo (preexistente, no introducido aquí):** `CategoryFilter` nunca se renderiza.
La condición es `isRestaurantes && clasificaciones.length > 0`, pero **ningún restaurante
tiene el campo `clasificacion`** — solo lo tienen `queHacer` (7) y `guiasTuristicos` (3).
El componente y su CSS son peso muerto. Si el filtro debía existir, probablemente tenía
que agrupar por `tipoComida`; es una decisión de producto, no de i18n.

---

## Fase 3 — Contenido editorial — ✅ HECHA

**164 strings** de contenido traducidos, más el copy de página en `src/i18n/pages.ts`.

| Archivo | Strings |
|---|---:|
| `src/data/itinerario.en.json` | 87 |
| `src/data/home.en.json` | 77 |
| `src/i18n/pages.ts` (copy del home + SEO) | ~40 por idioma |
| `src/pages/en/privacy-notice.astro` | documento completo |

### Estructura

```
src/data/home.json          # base: contenido ES + imagenes, mapas, iconos, rutas
src/data/home.en.json       # overlay por id, solo campos traducibles
src/data/itinerario.en.json # overlay por id de itinerario, refleja la estructura
src/i18n/pages.ts           # copy de cada pagina (encabezados, kickers, SEO, JSON-LD)
src/lib/home.ts             # fusion base + overlay
src/lib/itinerario.ts       # fusion profunda; arrays por posicion
src/lib/search-items.ts     # indice de busqueda con hrefs localizados
src/lib/home-schema.ts      # JSON-LD del home por idioma
src/components/HomeSections.astro  # cuerpo del home, compartido por / y /en/
```

`index.astro` pasó de **643 líneas a 20**: ahora solo aporta el `<Layout>` y el JSON-LD.
`en/index.astro` es su gemelo. Todo el markup vive una sola vez, en `HomeSections.astro`.

### Decisiones

- **`pages.ts` separado de `ui.ts`.** `ui.ts` es chrome reutilizable (botones, estados);
  `pages.ts` es texto que aparece una sola vez en una página concreta. Mezclarlos hacía
  que `ui.ts` dejara de tener un criterio claro.
- **Los `highlights` de los imperdibles son una trampa.** El carrusel los resalta buscándolos
  con una expresión regular dentro de la descripción; si la traducción no los deja como
  subcadena exacta, no se resalta nada y **falla en silencio**. Está verificado: los 34
  highlights (ES + EN) coinciden con su descripción.
- **Los itinerarios se fusionan por posición** porque sus elementos no tienen id propio. Si
  el overlay trae menos elementos que la base, los que sobran se quedan en español en vez
  de desaparecer.
- **`category` del buscador nunca se traduce.** Es una clave interna (`"Hotel"`,
  `"Restaurante"`…) que usa el filtro; lo que se traduce es su etiqueta visible.
- **`galeria` era dato muerto**: 4 registros declarados en `index.astro` que nunca se
  renderizaban. Se eliminaron en vez de traducirse.

### El aviso de privacidad en inglés es una traducción de cortesía

⚠️ El original en español es el documento con validez legal (LFPDPPP). La versión inglesa
**no la ha revisado nadie con criterio legal**. Antes de quitar el `noindex` conviene que
la revise quien corresponda, o añadir una nota que remita al original.

### Verificación (ejecutada)

- 12 páginas: 6 ES + 6 EN. **0 enlaces internos rotos.**
- Texto visible de las 6 páginas ES: idéntico al build previo a la Fase 0, salvo la palabra
  "English" del selector — que ahora sí aparece en las 6, incluido el home.
- Los 34 highlights son subcadena exacta de su descripción en ambos idiomas.
- Cobertura del overlay: 11/11 imperdibles, 4/4 visítanos, 2/2 artesanías, 4/4 itinerarios.
- `/en/` renderiza en inglés: títulos, kickers, stats, visítanos, carrusel, itinerarios
  (incluidos `DAY 1 — SATURDAY` y los consejos) y artesanías.
- **Buscador en inglés probado en navegador** (nunca se había podido ejecutar): escribir
  "restaurants" filtra por categoría vía alias → 38 resultados bajo el grupo "Restaurants";
  atajos `Eat / Sleep / Experiences / Certified Guides`; badges `Open`/`Closed`; enlaces
  profundos a `/en/where-to-stay`. Sin errores en consola.
- Nav, bottom nav y tarjetas de visítanos apuntan a `/en/...` dentro del sitio en inglés.
- `sitemap-0.xml` sigue conteniendo solo las 6 URLs en español.

---

## Fase 4 — Datos de negocios — ✅ HECHA

**366 valores traducidos · 552 instancias cubiertas · 100%.**

### Un diccionario por valor, no un overlay por registro

El plan original proponía `cholula.en.json` indexado por `nombre`. Al medir los datos
cambié de enfoque: las 552 instancias de texto se reducen a **366 valores únicos**
(34% de repetición). Un diccionario `campo → valor_es → valor_en`:

- evita traducir 186 duplicados;
- garantiza que el mismo texto se traduzca siempre igual;
- traduce **gratis** cualquier registro nuevo cuyo valor ya exista — importante porque
  `pnpm extract` regenera el catálogo desde WordPress;
- no duplica teléfonos, URLs ni galerías, igual que el overlay pretendía.

El campo acota el contexto, así que un mismo texto no puede acabar traducido de dos
formas distintas. Esto reemplaza a la vez el "mapa de enums" y el "overlay por nombre"
del plan original: **un solo mecanismo** para los 23 campos traducibles.

`src/lib/business-data.ts` aplica el diccionario con una **lista blanca** de campos, así
`nombre`, teléfonos, direcciones, URLs, galerías y horarios no se tocan ni por accidente.
Expone además `findUntranslated(locale)` para auditar cobertura.

### Las dos "reducciones" del plan no sobrevivieron a los datos

- **Tokenizar `amenidades`**: 22 tokens únicos frente a 15 cadenas completas. Tokenizar
  cuesta *más*.
- **Tokenizar `etiquetasChatbot`**: 127 tokens frente a 35 cadenas. Mucho más caro.
- **Plantilla para `distanciaGranPiramide`**: solo 4 de los 15 valores siguen el patrón
  `"{n} min a pie…"`; el resto son frases libres. No compensa.

Se tradujeron las cadenas completas en los tres casos.

### Fallo encontrado al verificar

Los horarios del buscador salían en español dentro de `/en/`: `formatHorarioDetalle`
tenía el diccionario de días solo en `es` y caía al fallback, y `SearchBar` lo llamaba sin
idioma. Se completó `en` en `src/lib/horario.ts` y la isla ahora recibe `lang`.

### Verificación (ejecutada)

- Cobertura: **552/552 instancias (100%)**, 366 entradas, **0 huérfanas** (ninguna
  entrada del diccionario sobra).
- Texto visible de las 6 páginas ES: idéntico al build previo a la Fase 0, salvo "English".
- `/en/where-to-stay`: chips (`Downtown`, `Pool`, `24h reception`), amenidades
  (`Restaurant, Garden, Terrace, 24-hour reception`) y distancias
  (`9 min walk from the Great Pyramid`) en inglés.
- Índice de búsqueda EN: `4 stars`, `Italian • Romantic · Elegant • Spectacular views`,
  `Monday: 13:00-20:00 • Tuesday: closed`.
- Detector de prosa en español sobre las 6 páginas EN: solo quedan nombres propios
  (`Plaza de la Concordia`, `Mesón de la Quinta`, `Atracadero Jardín`) y direcciones.

---

## Fase 5 — SEO y buscador

- `[slug].astro:61-82` — `SEO_CONFIG` por idioma (4 títulos + 4 descripciones × 2).
- JSON-LD: `inLanguage` (`index.astro:367`), `availableLanguage` (388),
  `breadcrumb "Inicio"` (`[slug].astro:132`), descripciones de schema (335, 366).
- `src/pages/en/[slug].astro` con `getStaticPaths` sobre los slugs en inglés.
- **Deep links:** `SearchBar` navega a `/donde-comer?id=3`, donde `3` es el índice del array.
  El overlay por `nombre` preserva el orden → los índices siguen siendo válidos en EN.
  Solo hay que localizar el path. **No** cambiar a keyed-by-slug sin revisar `[slug].astro:238-241`.
- **Búsqueda en inglés:** la normalización quita acentos (bien), pero los atajos de categoría
  (`SearchBar.tsx:249-255`) filtran comparando `item.category` contra `"Restaurante"`, `"Hotel"`,
  `"Experiencia"`, `"Guia"`. Esas categorías son claves internas, **no deben traducirse** —
  solo su etiqueta visible. Verificar que la traducción no toque `searchItems[].category`
  en `index.astro:245, 271, 302, 321`.

---

## Fase 6 — QA

- [ ] `/` byte-idéntico a producción salvo el switcher de idioma
- [ ] `hreflang` recíproco en ambos idiomas + `x-default`
- [ ] `sitemap-0.xml` incluye ambos idiomas con alternates
- [ ] Rich Results Test sobre `/en/where-to-eat`
- [ ] Buscador: sugerencias, atajos, "abierto ahora" y deep links funcionan en `/en/`
- [ ] Chips de BusinessCard encendidos correctamente en EN (regresión de Fase 0.2)
- [ ] Horarios correctos en ambos idiomas, incluidos los días cerrados
- [ ] GA4 sigue registrando; considerar una dimensión personalizada `language`
- [ ] `pnpm build` — `purge-css.cjs` recorre `dist/` recursivamente, así que `dist/en/`
      se escanea solo. Sin cambios necesarios, pero confirmar el tamaño final del CSS.
- [ ] Los 404: `/en/donde-comer` (slug ES bajo prefijo EN) debe redirigir o 404 limpio

---

## Orden sugerido

Fase 0 → 1 → 2 son puramente técnicas y no requieren traductor: dejan el sitio
listo para recibir contenido. Las fases 3 y 4 son las que dependen de tener las
traducciones, y pueden avanzar en paralelo entre sí. Fase 5 cierra el SEO.

El sitio puede publicarse al terminar la Fase 4 aunque falten traducciones sueltas:
el fallback a español evita páginas rotas.
