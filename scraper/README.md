# Scraper de tarifas (ENRE)

Componente futuro, no implementado todavía. Ver `docs/idea.md` (sección
"Scraper (batch)") para el contexto completo.

Objetivo: extraer periódicamente las tarifas vigentes del ENRE y exportarlas
como JSON con el shape del tipo `Tarifa` (ver `docs/idea.md`), para que
`backend/` lo sirva y `app/` lo consuma.

```
Scraper → JSON tarifas → backend/app → simulación local
```
