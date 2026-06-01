# sla-doublew — Contratación SLA DOUBLEW

App estática (vanilla HTML/JS, sin build) que genera contratos SLA con cálculo de tarifas, modalidad diaria o semestral, anexos y firma. **Standalone + integrable como iframe en el CRM** (`softwowinx/CRM_OPPS`, solo Licencia Fija/Anual).

## Propósito

Servir como herramienta de contratación de SLA. El comercial rellena el formulario, calcula el importe, genera el contrato (PDF imprimible) y envía/firma. El **state se serializa íntegro en query-string** (sin Supabase ni BD): cada SLA "guardado" es una URL larga con todos los datos. Adicionalmente persiste en `localStorage` para conveniencia local.

## Última actualización

**2026-06-01** — añadida integración con el CRM en `contratacion-sla-doublew.html` (commit `d121bc4`). Cuando la página se carga dentro de un iframe (`window.parent !== window`): (a) prepobla el formulario desde URLSearchParams, (b) añade un botón "Guardar en CRM" en `.actions`, (c) al pulsarlo emite postMessage `sla_saved` al parent con la URL canónica.

## Estructura

- `contratacion-sla-doublew.html` — formulario principal (cálculo + integración CRM).
- `control-seguimiento-sla-doublew.html` — vista de seguimiento/control del SLA contratado.
- `index.html` — landing.
- `css/` (vacío, estilos inline en el HTML).
- `apple-touch-icon.png`, `favicon-192.png`, `favicon.ico`, `double_w_logo_blanco.png` — assets.

Sin carpeta `js/` separada: todo el script vive embebido en `contratacion-sla-doublew.html` (líneas ~173 en adelante).

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

### URL prefill (deep-link)

Al cargar, lee `URLSearchParams` y prepobla los campos del formulario. Los radios `name="plan"` y `name="paymentTerms"` se setean por value; el resto se asigna como `value` al elemento con id == key.

### Consumidor en el CRM

`CRM_OPPS/oportunidades.html` → constante `SLA_URL`, helper `openSlaBtn(sid)`, listener `_onSlaSaved(data)` → muestra modal `#slaConfirmModal` → `_slaConfirmSI()` escribe `meta.sla_url`/`sla_creado`/`sla_creado_at` en el hito Doc Legal de la opp LFA.

## Estado de rama activa

`main` en producción. Última feature: integración iframe.

## Dependencias críticas

- **CRM_OPPS** (consumidor): depende de la URL del repo en `SLA_URL` y del payload del postMessage `sla_saved`. Si renombras este repo, actualiza la constante.
- **GitHub Pages**: deploy automático tras push a `main` (~1-2 min).

## Setup local

Sin build, sin npm, sin servidor. Abrir `contratacion-sla-doublew.html` en navegador para uso standalone. Para probar la integración con el CRM en local sería necesario servir ambos por http (no `file://`) y compartir el origen `softwowinx.github.io` (no práctico en local). Recomendación: trabajar contra producción tras push.

## Repo backup

`delat0rre/sla-doublew-backup` (privado). Remoto `backup` en este clon. Reconciliable con `/session-sync-ecosystem` desde `CRM_OPPS`.
