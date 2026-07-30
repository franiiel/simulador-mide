---
name: formatear
description: Formatea todo el código del repo con Prettier (TS/TSX/JS/JSON/Markdown/YAML). Usar cuando se pida formatear, emprolijar o unificar el estilo del código, o antes de commitear.
user-invocable: true
allowed-tools:
  - Bash(app/node_modules/.bin/prettier *)
  - Bash(git status *)
  - Bash(git diff *)
---

# /formatear — formateo del repo

Deja todo el repo con el mismo formato. Prettier cubre TS/TSX/JS/JSX/JSON/Markdown/YAML.
Python (`scraper/`) queda afuera: no hay formateador configurado todavía.

## Pasos

**1. Prettier — correr siempre desde la raíz del repo:**

```bash
app/node_modules/.bin/prettier --write "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"
```

El directorio de trabajo importa: Prettier busca `.prettierrc`, `.prettierignore` y
`.gitignore` desde donde se lo invoca, y los tres están en la raíz. Corriéndolo desde
`app/` no encontraría ninguno.

Prettier vive en `app/node_modules` porque `app/package.json` es el único manifiesto
del repo; por eso se lo llama por path y no con `npx`, que desde la raíz no lo
encontraría y lo descargaría de nuevo.

**2. Reportar** qué archivos cambiaron con `git status --short`. No commitear: eso lo
decide quien pidió el formateo.

## Verificar sin modificar

Para chequear si falta formatear algo, sin tocar archivos:

```bash
app/node_modules/.bin/prettier --check "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"
```

## Notas

- La config está en `.prettierrc`: comillas simples y ancho 100, elegidos para
  coincidir con el código que ya existía. `endOfLine: auto` evita que Prettier pelee
  con `core.autocrlf` de git en Windows.
- `.prettierignore` excluye `app/pnpm-lock.yaml` (generado por pnpm) y `app/assets`.
- **`app/domain/cuadrosEnre.json` lo genera el scraper**, que lo escribe con LF a propósito
  para que regenerarlo en otra plataforma no produzca un diff de miles de líneas. Prettier lo
  reformatea sin cambiar los datos, pero conviene no tocarlo a mano.
- Un hook `PostToolUse` en `.claude/settings.json` ya formatea cada archivo apenas se
  lo escribe o edita, así que esta skill sirve sobre todo para pasadas completas
  (archivos tocados a mano, o después de cambiar la config).
