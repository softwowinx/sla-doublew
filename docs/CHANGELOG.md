# CHANGELOG — sla-doublew

Historial cronológico de sesiones (más reciente primero). La referencia estable vive en [`CLAUDE.md`](../CLAUDE.md).

---

## 2026-06-06 — Ajustes de contratación, limpieza remota y mejora del PDF

Sesión de ajustes sobre la versión con persistencia Supabase. Commits `0ee4d33` (contenido + limpieza) y `441c262` (formato de importes + PDF). **Sin cambios** en la capa Supabase (`js/`), la integración CRM (`postMessage`/iframe) ni en la fórmula de `compute()`.

### Contratación (`contratacion-sla-doublew.html`)

**Formulario y textos**
- **Condiciones de pago** reducidas a dos opciones: eliminada "50% firma + 50% activación" (`name="paymentTerms"`); quedan "Pago anticipado 100%" (por defecto) y "Condición específica".
- **Títulos de modalidad** renombrados: "Facturación diaria" → **"Contratación por días"** y "Facturación semestral" → **"Paquete de horas"** (`<h3>` + valor por defecto y asignación JS de `#printModelName`). La etiqueta `model` ("SLA DOUBLEW - modalidad diaria/semestral") que viaja a Supabase/seguimiento se mantiene.
- Tarjeta semestral: bullet de horario "Horario de uso limitado: …" → "Horario: lunes a viernes de 10:00 a 18:00 CET, no festivos." (eliminado "de uso limitado").
- **Aceptación de condiciones**: eliminada la casilla `#acceptTerms` del formulario (listas Incluido/Excluido intactas). La aceptación queda en el PDF: el párrafo "al firmar… ambas partes confirman…" ya existía en §07 (no se duplica) y se añade la declaración del cliente ("El cliente declara conocer el alcance, las exclusiones, los canales, los horarios, la forma de cómputo y la ausencia de penalización automática salvo pacto escrito.").

**Anexos / condiciones complementarias (§04 formulario y §06 dossier)**
- Calendario laboral con año fijo ("2025 y 2026" / "2025-2026") → **"calendario laboral oficial DOUBLEW vigente"** (sin año, no caduca).
- Redacción 100% remota: "Las asistencias pueden ser realizadas…" → "Los servicios de soporte pueden ser prestados…".

**Limpieza de código muerto presencial en `compute()`**
- Eliminada la función `onsiteRate()` y las variables sin UI (`onsite`, `urgent`, `weekend`, `eventSupport`, `onsiteHours`, `dietDays`, `eventDays`, `distance`/`distanceRaw`, `rate`, `onsiteCost`, `dietCost`, `eventCost`). `extras` pasa a ser `dailyExtras`. **Cero cambio de cálculo** (esos sumandos ya valían 0 al no existir sus inputs). `weekend` era presencial-only; el festivo remoto vive en `holidayDays`/`holidayExtraHours`, intactos.

**Importes y PDF**
- **Separador de miles**: añadido `useGrouping:'always'` al formateador `EUR` (Intl `es-ES` no agrupaba los números de 4 dígitos; ahora 1.200,00 € / 1.452,00 €). Afecta a HTML, dossier (`money()`) y resumen de texto (un único objeto `EUR`).
- **"Presupuesto total"** en lugar de "estimado": subtítulo del Resumen económico (bloque solo-impresión), prosa del dossier ("El presupuesto total asciende a…") y línea del resumen de texto. Es el total contratado, no una estimación.
- **§03 Resumen económico del PDF** reescrito: la prosa "de tirón" (todos los importes en una frase) se sustituye por una frase breve + **desglose línea a línea** (concepto a la izquierda, importe a la derecha, separador antes del Subtotal y "Presupuesto total" resaltado). Estilos inline con `!important` para sobrevivir a la capa de impresión que elimina bordes/fondos.

### Notas técnicas
- Restauración de `paymentTerms`: las tres rutas (prefill iframe, standalone localStorage/URL, Supabase `state.radios`) ya toleran que el valor guardado no exista (guarda `if (el)`); un proyecto antiguo con "50%" cae al default sin error.
- `acceptTerms` viajaba a Supabase solo por serialización genérica (`state.fields` por id); al quitar la casilla deja de guardarse y los proyectos antiguos restauran sin error (`getElementById` con guarda en `deserializeSlaState`). No se tocó `js/`.
- El bloque `#printEconomicSummary` (rejilla) está dentro de `<main>`, que en impresión se oculta (`body>main{display:none}`), por lo que no se imprime; el resumen económico del PDF lo aporta el dossier `#printContract`.

---

## 2026-06-04 (b) — Persistencia en Supabase (BBDD dedicada, modelo Define-y-Firma)

Se dota a la app de **base de datos**. Hasta ahora el estado vivía solo en query-string + localStorage; ahora cada SLA es una fila en Supabase.

### Decisión de arquitectura
- **BBDD Supabase propia y dedicada** (no la del CRM). El usuario barajó alojarlo en la BBDD del CRM (patrón tabla `briefs`) pero se decidió por **proyecto dedicado replicando Define-y-Firma**. La similitud con DyF es la operativa de creación y el vínculo suelto a oportunidades/contactos; la topología es proyecto propio.
- Proyecto creado vía **Management API REST** (el MCP de Supabase no carga en VSCode): `sla-doublew`, ref `rrcwdlcoxlqemyzrnaln`, org `xynjgywjidohnyxseylg` (la de DyF/CRM), región eu-west-2.
- **RLS `allow_all`** (decisión explícita, modelo DyF). Riesgo asumido: cualquiera con la anon key pública puede volcar todas las filas. Alternativa (token por SLA) documentada como evolución futura.

### Esquema (`docs/schema.sql`)
- `sla_projects`: `id`, `sla_code` (`SLA-YYYYMM-XXXX`), `cliente`, `opportunity_id`/`contact_id` (ref. suelta texto), `plan`, `total`, `state` jsonb (contrato completo), `seguimiento_notes`, `created_by`/`updated_by`, timestamps.
- `sla_incidents`: FK `sla_id` (ON DELETE CASCADE), `descripcion`, `solucion`, `estado`, `clasificacion`, `fecha_inicio`/`fecha_fin`, `minutos`, **`data` jsonb** (fila completa de la UI de 12 campos, sin pérdida), `created_by`, timestamps.
- Triggers `updated_at`, índices por `sla_id`/`opportunity_id`. Verificado CRUD anónimo + cascade end-to-end vía REST.

### Capa de app (nueva carpeta `js/`, patrón DyF)
- `supabase-config.js` (URL+anon), `api.js` (CRUD de ambas tablas), `sla-persist.js` (contratación), `sla-seguimiento.js` (seguimiento).
- **Contratación**: barra superior con desplegable **Cargar proyecto** + botones **Nuevo**/**Guardar** + código SLA visible. Serialización completa del formulario (`{fields, radios}`) a `state`. Identificación por nombre (sessionStorage). Al guardar: crea/actualiza, refleja `?id=` en la URL (history.replaceState) y refresca el desplegable.
- **postMessage al CRM**: ahora envía **url corta `?id=<uuid>`** en vez de la query-string gigante (retrocompatible: el CRM solo lee `.url`). Se retiró el botón antiguo "Guardar en CRM" (url larga, sin BD); el guardado lo centraliza la barra superior. Se conserva el prefill por query-string para enlaces antiguos.
- **Seguimiento**: si la URL trae `?id=`, carga "Lo contratado" + cliente/contacto desde `sla_projects` (solo lectura) e incidencias desde `sla_incidents`. Alta/edición (debounced ~700 ms) y baja persisten en BD; las notas de contacto van a `seguimiento_notes`. Sin `id`, mantiene el comportamiento demo (localStorage/URL).
- `.github/workflows/supabase-keepalive.yml`: ping REST cada 5 días (anti-hibernación, plan free).

### Pendiente / observaciones
- 🟡 Validación visual en navegador real (creado y probado por API + syntax-check; falta el click-through de UI).
- 🟡 El CRM (`CRM_OPPS`) podría adaptarse para abrir el SLA con `?id=` y/o listar SLA por `opportunity_id` (no imprescindible; el `postMessage` ya manda la url corta).
- Seguridad: anon key pública en repo (por diseño Supabase) + RLS `allow_all` (riesgo asumido explícitamente).

---

## 2026-06-04 (a) — Tarifas diaria, dossier en prosa, rediseño de Seguimiento y persistencia

Commits: `0a0c530` (contratación: tarifas/prosa/impresión), `8aad269` (seguimiento), `0ae9831` (contratación: colapsables + persistencia).

### Contratación (`contratacion-sla-doublew.html`)

**Tarifas (modalidad diaria)**
- Desdoblado el día de activación en **días laborables (80 €)** y **días festivos/fin de semana (160 €)** — campos `activationDays` y nuevo `holidayDays`, ambos por defecto **0** (antes el mínimo era 1).
- Ampliación de horario en dos tramos: **25 €/h** laborable (`extraHours`) y **40 €/h** festivo-finde (`holidayExtraHours`).
- `compute()`: `base = workdays·80 + holidayDays·160`; `dailyExtras = extraHours·25 + holidayExtraHours·40`.
- Tarjeta del plan diario muestra ambos precios; viñeta "tarifas diferenciadas".

**Eliminación de servicios presenciales** (decisión: DOUBLEW no presta presencial)
- Retiradas **todas** las referencias a presencial / desplazamiento / dietas / eventos en los 3 niveles: formulario (sección "Servicios complementarios" eliminada), resumen de texto, dossier imprimible y anexos (visibles y en PDF). Verificado: 0 referencias de texto residuales (salvo "presupuesto específico" legítimo de formaciones/3os).

**Otros**
- Nuevo campo **"Fecha fin"** (`endDate`) en Datos del servicio.
- Resumen económico (aside) con **desglose por concepto** (`breakdownHtml()` → líneas días/festivos/horas extra "si procede"), importes con `white-space:nowrap` para no partirse.
- Recuadros de **firma** alineados a ambos lados (caja `sig-box`, `margin-top:auto`).
- **Dossier imprimible** (`renderPrintContract`) reescrito en **prosa** (frases en vez de "Etiqueta: valor"), **omitiendo campos vacíos**. Capas CSS de impresión iteradas `v6`→`v9`: decisión del usuario = "documento de contrato con estilo de la app" → luego "texto puro, sin cajas" → `print-text-v9` deja flujo continuo sin saltos de página con huecos. Quitado el footer "Documento generado…".
- Secciones **§04 Anexos** y **ESG** convertidas a `<details>` colapsables (colapsadas por defecto).
- **Persistencia**: bloque al final del `<body>` que en standalone restaura el formulario desde URL o `localStorage`. Corrige el bug de perder el plan (semestral→diaria) al ir a Seguimiento y volver. Efecto secundario asumido: el form recuerda el último contrato (no arranca en blanco).

### Seguimiento (`control-seguimiento-sla-doublew.html`)

- **Cliente y contacto**: reducido a datos identificativos + contacto del cliente (empresa, cliente final, contacto, cargo, email, teléfono), **solo lectura** (se cargan desde contratación), + **notas de contacto editables**. Eliminado el bloque de proveedor y CIF/DNI. Bloque colapsable.
- **"Lo contratado"** (antes "Datos del seguimiento"): describe lo contratado (producto, modelo, **días contratados** con desglose laborable/festivo, **horas contratadas** con paquetes, **inicio/fin de actuación**), solo lectura, colapsable. Eliminados "Bolsa SLA contratada" editable y "Fecha de control".
- **Registro de incidencias**: tarjetas **colapsables** por incidencia (resumen `fecha · descripción · estado`); botón **"Incidencia abierta/cerrada"**; **"Tiempo dedicado" auto-calculado** (`Fin − Inicio`, solo lectura) — antes no calculaba; Descripción/Solución comprimidas con botón de despliegue; **borrado con confirmación** inline; formato compacto y campos reordenados.
- **Resumen generado**: omite campos vacíos.
- Botones **Copiar/Imprimir** movidos al pie; eliminado **"Vaciar registros"**.
- **Panel lateral adaptativo** (decisión: "Días + actividad" para diaria): semestral = bolsa de horas (contratado/consumido/restante + barra + estado); diaria = actividad (días con actividad sobre contratados + barra, incidencias abiertas/cerradas, horas registradas). Detección: semestral si `slaHours > 0`.

### Decisiones
- **No presencial**: se elimina de la app toda tarifa/condición presencial. (Los `.docx` aún no lo reflejan.)
- **Impresión**: documento de contrato reestilizado → finalmente **prosa en texto continuo**, sin cajas, omitiendo vacíos.
- **Panel consumo diaria**: variante "Días + actividad".
- **`SLA docus/`**: carpeta con plantillas `.docx`/`.xlsx` (contratos + tarifas internas) **NO se sube** al repo (es público → exposición de datos). Se queda solo en local, sin versionar.

### Problemas abiertos / pendientes
- 🔴 **Documentos vs app desalineados**: `SLA docus/` (SLA_V1/V2, Anexo I diaria/semestral) **no** reflejan: tarifa festivos 160 €, ampliación 40 €, eliminación de presencial. El Anexo I semestral es **íntegramente** sobre desplazamiento/presencial → contradice la app. Pendiente actualizar los `.docx` o reescribirlos.
- 🟡 Persistencia: valorar botón "Nuevo/limpiar" para arrancar un contrato en blanco.
- 🟡 Consumo diaria: implementado y validado por lógica; pendiente confirmación visual final del usuario.

### Notas técnicas
- Sin dependencias, sin build, sin variables de entorno. App estática.
- Contrato de transferencia (`slaTransferData`) ampliado con `endDate`, `holidayDays`, `extraHours`, `holidayExtraHours` (retrocompatible; el consumidor CRM solo usa `url`/`clientCompany`/`plan`/`total`).
- Remoto: solo `origin` (softwowinx/sla-doublew). No hay `backup` configurado en este clon.
