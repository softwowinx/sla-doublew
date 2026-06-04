# CHANGELOG — sla-doublew

Historial cronológico de sesiones (más reciente primero). La referencia estable vive en [`CLAUDE.md`](../CLAUDE.md).

---

## 2026-06-04 — Tarifas diaria, dossier en prosa, rediseño de Seguimiento y persistencia

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
