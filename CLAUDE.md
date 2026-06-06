# sla-doublew — Contratación SLA DOUBLEW

App estática (vanilla HTML/JS, sin build) que genera contratos SLA con cálculo de tarifas, modalidad diaria o semestral, anexos y firma. **Standalone + integrable como iframe en el CRM** (`softwowinx/CRM_OPPS`, solo Licencia Fija/Anual).

## Propósito

Servir como herramienta de contratación de SLA. El comercial rellena el formulario, calcula el importe, genera el contrato (PDF imprimible) y envía/firma. **Persistencia en Supabase dedicado** (modelo Define-y-Firma): cada SLA es una fila en `sla_projects` y se identifica por `?id=<uuid>`. Se conserva el `localStorage` y el prefill por query-string como conveniencia/retrocompatibilidad.

## Última actualización

**2026-06-06** — ajustes de contratación y mejora del PDF (commits `0ee4d33`, `441c262`). **Condiciones de pago** a dos opciones (eliminada "50% firma + 50% activación"). **Títulos de modalidad** renombrados a "Contratación por días" / "Paquete de horas" (tarjetas + `#printModelName`). **Aceptación de condiciones** fuera del formulario: ahora es una declaración del cliente en el PDF (§07). **Limpieza de código muerto presencial** en `compute()` (eliminada `onsiteRate()` y variables sin UI; cero cambio de cálculo). **Anexos** §04/§06: calendario "vigente" sin año fijo y redacción 100% remota. **Importes** con separador de miles correcto (`useGrouping:'always'`; Intl es-ES no agrupaba 4 dígitos). Wording **"Presupuesto total"** (no "estimado") en PDF y resumen. **§03 del PDF** reescrito de prosa a **desglose línea a línea**. Sin tocar Supabase (`js/`), integración CRM ni la fórmula de `compute()`. Detalle en [docs/CHANGELOG.md](docs/CHANGELOG.md).

**2026-06-04 (b)** — **persistencia en Supabase**. Proyecto dedicado `sla-doublew` (ref `rrcwdlcoxlqemyzrnaln`, modelo Define-y-Firma). Tablas `sla_projects` (contrato en JSONB `state`) y `sla_incidents` (incidencias del seguimiento, con `data` jsonb sin pérdida), RLS `allow_all`. Nueva carpeta `js/` (`supabase-config.js`, `api.js`, `sla-persist.js`, `sla-seguimiento.js`). Barra superior en contratación (Cargar/Nuevo/Guardar), `postMessage` con **url corta por id**, seguimiento que lee de BD y persiste incidencias + notas. Diseño en [docs/superpowers/specs/2026-06-04-sla-persistencia-supabase-design.md](docs/superpowers/specs/2026-06-04-sla-persistencia-supabase-design.md). Detalle en [docs/CHANGELOG.md](docs/CHANGELOG.md).

**2026-06-04 (a)** — sesión amplia (commits `0a0c530`, `8aad269`, `0ae9831`). Tarifas diaria desdobladas (laborable 80 € / festivo-finde 160 €) y ampliación en dos tramos (25 €/40 €); eliminadas **todas** las referencias a servicios presenciales/desplazamiento/dietas/eventos; campo "Fecha fin"; dossier imprimible reescrito en **prosa** (omite campos vacíos, formato texto continuo); rediseño completo de la hoja de **Seguimiento** (datos solo-lectura desde contratación, incidencias colapsables con estado abierta/cerrada y tiempo auto-calculado, panel de consumo adaptativo diaria/semestral); secciones Anexos/ESG colapsables; persistencia del formulario vía localStorage al navegar. Narrativa completa en [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Modelo de tarifas (referencia)

- **Diaria**: día laborable **80 €**, día festivo/fin de semana **160 €** (campos `activationDays`/`holidayDays`, por defecto 0). Ampliación de horario: **25 €/h** laborable, **40 €/h** festivo-finde (`extraHours`/`holidayExtraHours`). IVA 21%.
- **Semestral**: paquete cerrado de 10 h por **600 €** (`hourPacks`), bolsa válida 6 meses. Clasificación de incidencias C1/C2/C3 + consulta.
- **NO se presta servicio presencial** — el formulario, el resumen y el dossier no contienen tarifas presenciales, desplazamiento, dietas ni eventos. (Los `.docx` en `SLA docus/` todavía sí: pendiente actualizarlos — ver CHANGELOG.)

## Estructura

- `contratacion-sla-doublew.html` — formulario principal (cálculo + integración CRM).
- `control-seguimiento-sla-doublew.html` — vista de seguimiento/control del SLA contratado.
- `index.html` — landing.
- `css/` (vacío, estilos inline en el HTML).
- `apple-touch-icon.png`, `favicon-192.png`, `favicon.ico`, `double_w_logo_blanco.png` — assets.

- `js/` — capa de persistencia Supabase: `supabase-config.js` (URL+anon del proyecto dedicado), `api.js` (CRUD `sla_projects`/`sla_incidents`), `sla-persist.js` (barra superior + serialización del contrato en contratación), `sla-seguimiento.js` (carga por `id` + incidencias en seguimiento).
- `docs/schema.sql` — esquema de la BBDD. `.github/workflows/supabase-keepalive.yml` — ping cada 5 días (anti-hibernación).

El resto del script de cada página sigue embebido inline en su HTML; solo la capa de BD vive en `js/`.

- **`contratacion`**: `compute()` (cálculo), `breakdownHtml()` (desglose del resumen económico), `renderPrintContract()` (dossier en prosa), `slaTransferData()` (serialización), bloque iframe-CRM y bloque de restauración standalone (al final del `<body>`). Capas CSS de impresión `v6`→`v9` (la última, `print-text-v9`, fuerza el dossier a texto continuo).
- **`control-seguimiento`**: `loadContractData()` (autorrelleno solo-lectura + cómputo de días/horas contratadas), `rowHtml()`/`rows()`/`render()` (tabla de incidencias como tarjetas colapsables), `summary()` (resumen que omite vacíos). Panel lateral adaptativo según modalidad.

`SLA docus/` (sin versionar, solo local): plantillas `.docx`/`.xlsx` de contrato (no se suben — repo público).

## Contratos e interfaces

### postMessage al parent (cuando está en iframe)

Origen target: `https://softwowinx.github.io`

```js
{
  type: 'sla_saved',
  url: '<location.origin>/sla-doublew/contratacion-sla-doublew.html?<query-string-completo>',
  updated_at: '<ISO>',
  clientCompany: '<string>',
  plan: 'daily' | 'semester',
  total: '<EUR formatted>'
}
```

### URL prefill / transferencia a Seguimiento

`slaTransferData()` serializa el state en query-string y `localStorage['doublew_sla_contract']`. Incluye, además de los campos del formulario: `plan`, `model`, `slaHours` (semestral), `activationDays`/`holidayDays` (diaria), `extraHours`/`holidayExtraHours`, `hourPacks`, `startDate`/`endDate`, `total`. **Seguimiento** lee estos campos (solo-lectura) para describir lo contratado y alimentar el panel de consumo.

Al cargar: en **iframe** prepobla desde `URLSearchParams`; en **standalone** restaura desde URL o `localStorage` (radios `plan`/`paymentTerms` por value, resto por id==key). Esto persiste el formulario al navegar entre páginas o refrescar.

### Consumidor en el CRM

`CRM_OPPS/oportunidades.html` → constante `SLA_URL`, helper `openSlaBtn(sid)`, listener `_onSlaSaved(data)` → muestra modal `#slaConfirmModal` → `_slaConfirmSI()` escribe `meta.sla_url`/`sla_creado`/`sla_creado_at` en el hito Doc Legal de la opp LFA.

## Estado de rama activa

`main` en producción, sincronizada con `origin` (último commit `441c262`, sesión 2026-06-06). Todo lo de las sesiones 2026-06-04 y 2026-06-06 está desplegado vía GitHub Pages. **Pendiente**: actualizar los `.docx` de `SLA docus/` para que cuadren con las tarifas nuevas y la eliminación de presencial; valorar botón "Nuevo/limpiar" en contratación (la persistencia hace que el form recuerde el último contrato, no arranca en blanco).

## Dependencias críticas

- **CRM_OPPS** (consumidor): depende de la URL del repo en `SLA_URL` y del payload del postMessage `sla_saved`. Si renombras este repo, actualiza la constante.
- **GitHub Pages**: deploy automático tras push a `main` (~1-2 min).

## Setup local

Sin build, sin npm, sin servidor. Abrir `contratacion-sla-doublew.html` en navegador para uso standalone. Para probar la integración con el CRM en local sería necesario servir ambos por http (no `file://`) y compartir el origen `softwowinx.github.io` (no práctico en local). Recomendación: trabajar contra producción tras push.

## Repo backup

`delat0rre/sla-doublew-backup` (privado) documentado como backup. **Atención:** en este clon `git remote` solo tiene `origin` (softwowinx/sla-doublew); el remoto `backup` **no está configurado**. Si se quiere backup, añadirlo con `git remote add backup <url>`. Reconciliable con `/session-sync-ecosystem` desde `CRM_OPPS`.
