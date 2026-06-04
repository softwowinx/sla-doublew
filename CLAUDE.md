# sla-doublew — Contratación SLA DOUBLEW

App estática (vanilla HTML/JS, sin build) que genera contratos SLA con cálculo de tarifas, modalidad diaria o semestral, anexos y firma. **Standalone + integrable como iframe en el CRM** (`softwowinx/CRM_OPPS`, solo Licencia Fija/Anual).

## Propósito

Servir como herramienta de contratación de SLA. El comercial rellena el formulario, calcula el importe, genera el contrato (PDF imprimible) y envía/firma. El **state se serializa íntegro en query-string** (sin Supabase ni BD): cada SLA "guardado" es una URL larga con todos los datos. Adicionalmente persiste en `localStorage` para conveniencia local.

## Última actualización

**2026-06-04** — sesión amplia (commits `0a0c530`, `8aad269`, `0ae9831`). Tarifas diaria desdobladas (laborable 80 € / festivo-finde 160 €) y ampliación en dos tramos (25 €/40 €); eliminadas **todas** las referencias a servicios presenciales/desplazamiento/dietas/eventos; campo "Fecha fin"; dossier imprimible reescrito en **prosa** (omite campos vacíos, formato texto continuo); rediseño completo de la hoja de **Seguimiento** (datos solo-lectura desde contratación, incidencias colapsables con estado abierta/cerrada y tiempo auto-calculado, panel de consumo adaptativo diaria/semestral); secciones Anexos/ESG colapsables; persistencia del formulario vía localStorage al navegar. Narrativa completa en [docs/CHANGELOG.md](docs/CHANGELOG.md).

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

Sin carpeta `js/` separada: todo el script vive embebido en cada HTML.

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

`main` en producción, sincronizada con `origin`. Todo lo de la sesión 2026-06-04 está desplegado. **Pendiente**: actualizar los `.docx` de `SLA docus/` para que cuadren con las tarifas nuevas y la eliminación de presencial; valorar botón "Nuevo/limpiar" en contratación (la persistencia hace que el form recuerde el último contrato, no arranca en blanco).

## Dependencias críticas

- **CRM_OPPS** (consumidor): depende de la URL del repo en `SLA_URL` y del payload del postMessage `sla_saved`. Si renombras este repo, actualiza la constante.
- **GitHub Pages**: deploy automático tras push a `main` (~1-2 min).

## Setup local

Sin build, sin npm, sin servidor. Abrir `contratacion-sla-doublew.html` en navegador para uso standalone. Para probar la integración con el CRM en local sería necesario servir ambos por http (no `file://`) y compartir el origen `softwowinx.github.io` (no práctico en local). Recomendación: trabajar contra producción tras push.

## Repo backup

`delat0rre/sla-doublew-backup` (privado) documentado como backup. **Atención:** en este clon `git remote` solo tiene `origin` (softwowinx/sla-doublew); el remoto `backup` **no está configurado**. Si se quiere backup, añadirlo con `git remote add backup <url>`. Reconciliable con `/session-sync-ecosystem` desde `CRM_OPPS`.
