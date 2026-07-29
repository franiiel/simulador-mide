// Hook PostToolUse: formatea con Prettier el archivo que Write/Edit acaba de tocar.
// El payload del hook llega por stdin y se parsea con node porque jq no está instalado.

const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(raw);
    const file =
      (payload.tool_response && payload.tool_response.filePath) ||
      (payload.tool_input && payload.tool_input.file_path);
    if (!file) return;

    // Se invoca el CLI con node en vez del shim de .bin: en Windows ese shim es un
    // script de shell que execFileSync no puede ejecutar directamente.
    const cli = path.join(repoRoot, 'app', 'node_modules', 'prettier', 'bin', 'prettier.cjs');

    // Las rutas van absolutas para no depender del directorio desde el que corra el hook.
    // --ignore-unknown deja pasar sin tocar lo que Prettier no maneja (.go, .py).
    execFileSync(
      process.execPath,
      [
        cli,
        '--write',
        '--ignore-unknown',
        '--ignore-path',
        path.join(repoRoot, '.prettierignore'),
        file,
      ],
      { stdio: 'ignore', timeout: 20000 },
    );
  } catch {
    // Un fallo de formateo nunca debe bloquear la edición.
  }
});
