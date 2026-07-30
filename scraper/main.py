# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "beautifulsoup4"]
# ///
"""Scraper de cuadros tarifarios T1-R del ENRE (Edenor).

Extrae los cargos fijos y variables por bloque R1-R6 y los emite como JSON con el mismo
shape que el tipo CuadroEnre de app/domain/types.ts. El motor de la app deriva de ahí los
precios por tramo que cobra MIDE (ver precioTramo() en app/domain/tarifas.ts).

Correr con uv, que resuelve las dependencias solo:

    uv run scraper/main.py                    # el último cuadro publicado
    uv run scraper/main.py --todos            # todos los períodos del índice
    uv run scraper/main.py --periodo 2025-10  # uno puntual
    uv run scraper/main.py --check            # valida los parsers, no escribe

OJO: el ENRE publica dos formatos distintos de cuadro y los dos siguen siendo relevantes,
porque el motor valida contra comprobantes de 2025 y de 2026. Ver parse_cuadro().
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context

BASE = "https://www.enre.gov.ar/web/tarifasd.nsf/todoscuadros"
INDICE = f"{BASE}?openview"

# Las páginas son Lotus Notes viejo y no declaran el charset de forma utilizable.
ENCODING = "ISO-8859-1"

DISTRIBUIDORA = "edenor"

# Se escribe dentro de app/ porque es el consumidor y porque Metro (el bundler de Expo) no
# resuelve imports que salgan de la raíz del proyecto sin configurarle watchFolders.
SALIDA = Path(__file__).parent.parent / "app" / "domain" / "cuadrosEnre.json"

# El cuadro publica el último bloque como "+700", sin techo. MIDE lo trata como si el tope
# fuera 1400: así lo imprime el ticket ("Hasta 1400kWh"). Ese número es conocimiento de MIDE
# inyectado acá en la traducción, NO un dato del ENRE. Arriba de 1400 el motor lanza error a
# propósito, porque ningún comprobante cruzó ese acumulado.
TOPE_ULTIMO_BLOQUE = 1400

# Nombre de sección -> nivel de subsidio. Los cuadros hasta 2025-12 traen tres niveles; los
# de 2026 en adelante solo distinguen con/sin subsidio, así que N3 deja de estar disponible.
# "con subsidio" -> N2 está validado contra comprobantes reales: los tickets dicen "TARIFA
# RESIDENCIAL NIVEL 2" y los precios derivados de esa sección los reproducen exactos.
NIVELES = {
    "nivel 1": "N1",
    "sin subsidio": "N1",
    "nivel 2": "N2",
    "con subsidio": "N2",
    "nivel 3": "N3",
}

MESES = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12,
}

# La consola de Windows usa cp1252 y no puede imprimir los símbolos de los mensajes (✓, ≤).
for _flujo in (sys.stdout, sys.stderr):
    if hasattr(_flujo, "reconfigure"):
        _flujo.reconfigure(encoding="utf-8", errors="replace")


@dataclass
class BloqueEnre:
    hastaKwh: int
    cargoFijo: float
    cargoVariableBase: float
    cargoVariableExcedente: float | None


@dataclass
class CuadroEnre:
    periodo: str
    distribuidora: str
    nivel: str
    consumoBaseKwh: int
    bloques: list[BloqueEnre]
    fuente: str


class ErrorDeFormato(Exception):
    """El HTML no tiene la forma esperada. Nunca adivinar: es mejor fallar."""


# ---------------------------------------------------------------------------
# Descarga
# ---------------------------------------------------------------------------


class _TLSViejo(HTTPAdapter):
    """El servidor del ENRE negocia ciphers que OpenSSL 3 rechaza por defecto.

    Sin esto, todo request muere con SSLV3_ALERT_HANDSHAKE_FAILURE: OpenSSL 3 usa
    SECLEVEL=2 y el ENRE ofrece claves/ciphers de una generación anterior.

    OJO con lo que esto NO hace: el certificado se sigue verificando normalmente. Solo se
    aceptan algoritmos más viejos, que es lo mínimo para que el handshake cierre. Se probó
    que alcanza con bajar el nivel; no hace falta forzar TLS 1.2 ni renegociación legacy.
    Y lo que se descarga son datos públicos por GET, sin credenciales de por medio.
    """

    def init_poolmanager(self, *args, **kwargs):
        contexto = create_urllib3_context(ciphers="DEFAULT@SECLEVEL=1")
        kwargs["ssl_context"] = contexto
        return super().init_poolmanager(*args, **kwargs)


def _sesion() -> requests.Session:
    sesion = requests.Session()
    sesion.mount("https://", _TLSViejo())
    return sesion


_SESION = _sesion()


def _get(url: str) -> BeautifulSoup:
    respuesta = _SESION.get(url, timeout=30)
    respuesta.raise_for_status()
    respuesta.encoding = ENCODING
    return BeautifulSoup(respuesta.text, "html.parser")


def listar_periodos() -> list[tuple[str, str]]:
    """[(periodo 'YYYY-MM', id del documento)], del más reciente al más viejo."""
    sopa = _get(INDICE)
    encontrados: list[tuple[str, str]] = []
    vistos: set[str] = set()

    for enlace in sopa.find_all("a", href=True):
        id_doc = re.search(r"todoscuadros/([0-9A-F]{32})", enlace["href"], re.I)
        fecha = re.search(r"(\d{2})-(\d{4})", enlace.get_text())
        if not (id_doc and fecha):
            continue
        periodo = f"{fecha.group(2)}-{fecha.group(1)}"
        if periodo not in vistos:
            vistos.add(periodo)
            encontrados.append((periodo, id_doc.group(1).upper()))

    if not encontrados:
        raise ErrorDeFormato(f"No se encontró ningún cuadro en el índice ({INDICE})")
    return encontrados


# ---------------------------------------------------------------------------
# Parseo
# ---------------------------------------------------------------------------


def _numero(texto: str) -> float:
    """'1,710.71' -> 1710.71. El ENRE usa formato inglés: coma de miles, punto decimal."""
    limpio = texto.strip().replace(",", "")
    try:
        return float(limpio)
    except ValueError as e:
        raise ErrorDeFormato(f"No se pudo leer el número {texto!r}") from e


def _celdas(fila: Tag) -> list[str]:
    return [
        celda.get_text(" ", strip=True).replace("\xa0", " ").strip()
        for celda in fila.find_all("td")
    ]


def _consumo_base_estacional(periodo: str, texto_pagina: str) -> int:
    """Consumo base del formato 2026, que es estacional y vive en una nota al pie:

    'Períodos dic/feb y mayo/agosto: consumo base de 300 kWh/mes. Períodos marzo/abril y
    septiembre/noviembre: consumo base de 150 kWh/mes.'

    Se parsea la nota en vez de hardcodear los meses para que un cambio de régimen salte
    como error de formato y no como un número silenciosamente equivocado.
    """
    mes = int(periodo.split("-")[1])

    for tramos, valor in re.findall(
        r"[Pp]er.odos?\s+(.{0,70}?):\s*consumo base de\s*([\d.]+)\s*kWh", texto_pagina
    ):
        nombrados = [
            MESES[palabra[:3].lower()]
            for palabra in re.findall(r"[A-Za-zÁÉÍÓÚáéíóú]{3,12}", tramos)
            if palabra[:3].lower() in MESES
        ]
        # Los rangos vienen en pares: "dic/feb y mayo/agosto" son dos intervalos inclusive.
        pares = [nombrados[i : i + 2] for i in range(0, len(nombrados) - 1, 2)]
        for desde, hasta in pares:
            dentro = desde <= mes <= hasta if desde <= hasta else (mes >= desde or mes <= hasta)
            if dentro:
                return int(float(valor))

    raise ErrorDeFormato(
        f"No se encontró el consumo base de {periodo} en la nota al pie del cuadro"
    )


def _seccion_a_nivel(titulo: str) -> str | None:
    bajo = titulo.lower()
    if "tarifa 1 - r" not in bajo:
        return None
    for clave, nivel in NIVELES.items():
        if clave in bajo:
            return nivel
    return None


def _tablas_de_la_seccion(titulo: Tag) -> list[Tag]:
    """Las tablas entre este <h4> y el siguiente encabezado de sección."""
    tablas: list[Tag] = []
    for elemento in titulo.next_elements:
        if not isinstance(elemento, Tag):
            continue
        if elemento.name in ("h3", "h4") and elemento is not titulo:
            break
        if elemento.name == "table":
            tablas.append(elemento)
    return tablas


def _tope_del_rango(etiqueta: str) -> int:
    """'Cargo Fijo 151-400' -> 400. 'Cargo Fijo +700' -> TOPE_ULTIMO_BLOQUE."""
    if "+" in etiqueta:
        return TOPE_ULTIMO_BLOQUE
    numeros = re.findall(r"\d+", etiqueta)
    if not numeros:
        raise ErrorDeFormato(f"No se pudo leer el rango de {etiqueta!r}")
    return int(numeros[-1])


def _bloques_de_seccion(
    titulo: Tag, periodo: str, texto_pagina: str
) -> tuple[list[BloqueEnre], int]:
    """Lee las 6 tablas que siguen a un <h4> de sección. Devuelve (bloques, consumo base)."""
    bloques: list[BloqueEnre] = []
    base_por_label: int | None = None
    # Los niveles subsidiados publican dos cargos variables por bloque (base y excedente);
    # los que no tienen subsidio publican uno solo. Ese es el indicio de si el nivel tiene
    # consumo base o no, y hay que mirarlo antes de salir a buscarlo.
    hay_excedente = False

    for tabla in _tablas_de_la_seccion(titulo):
        fijo: float | None = None
        tope: int | None = None
        variables: list[float] = []

        for fila in tabla.find_all("tr"):
            celdas = _celdas(fila)
            if len(celdas) < 4:
                continue
            # Columnas: label | unidad | EDENOR | EDESUR
            etiqueta, valor_edenor = celdas[0], celdas[2]
            bajo = etiqueta.lower()

            if bajo.startswith("cargo fijo"):
                fijo = _numero(valor_edenor)
                tope = _tope_del_rango(etiqueta)
            elif bajo.startswith("cargo variable"):
                variables.append(_numero(valor_edenor))
                # Formato viejo: el consumo base está en el label ("hasta 350"), y cambia
                # según el nivel (N2 usa 350, N3 usa 250).
                if encontrado := re.search(r"hasta\s+(\d+)", etiqueta, re.I):
                    base_por_label = int(encontrado.group(1))

        if fijo is None or tope is None or not variables:
            continue

        hay_excedente = hay_excedente or len(variables) > 1
        bloques.append(
            BloqueEnre(
                hastaKwh=tope,
                cargoFijo=fijo,
                cargoVariableBase=variables[0],
                # Los niveles sin subsidio publican un solo cargo variable. Se repite en vez
                # de dejarlo en None: el motor multiplica los kWh excedentes por este valor,
                # y un None ahí se volvería un cobro de $0 en silencio.
                cargoVariableExcedente=variables[1] if len(variables) > 1 else variables[0],
            )
        )

    if len(bloques) != 6:
        raise ErrorDeFormato(
            f"{periodo}: se esperaban 6 bloques R1-R6 en la sección "
            f"{titulo.get_text(' ', strip=True)!r}, se encontraron {len(bloques)}"
        )

    if not hay_excedente:
        # Nivel sin subsidio: no hay consumo base porque no hay nada subsidiado. Con 0 todos
        # los kWh cuentan como excedente, y como ahí se repitió el mismo precio el costo sale
        # igual por cualquier camino.
        return bloques, 0

    base = base_por_label or _consumo_base_estacional(periodo, texto_pagina)
    return bloques, base


def parse_cuadro(html: BeautifulSoup, periodo: str, id_doc: str) -> list[CuadroEnre]:
    """Todas las secciones T1-R de Edenor de un cuadro, una por nivel disponible.

    Los <h4> de sección cambiaron de nombre en 2026 ("Nivel 2 bajos ingresos" pasó a ser
    "con subsidio"), y con ellos el formato de los cargos variables. NIVELES cubre los dos
    vocabularios, y el consumo base se resuelve según cuál aplique.
    """
    texto_pagina = html.get_text(" ", strip=True)
    cuadros: list[CuadroEnre] = []

    for titulo in html.find_all(["h3", "h4"]):
        nivel = _seccion_a_nivel(titulo.get_text(" ", strip=True))
        if nivel is None:
            continue
        bloques, base = _bloques_de_seccion(titulo, periodo, texto_pagina)
        cuadros.append(
            CuadroEnre(
                periodo=periodo,
                distribuidora=DISTRIBUIDORA,
                nivel=nivel,
                consumoBaseKwh=base,
                bloques=bloques,
                fuente=f"ENRE {id_doc}",
            )
        )

    if not cuadros:
        raise ErrorDeFormato(f"{periodo}: no se encontró ninguna sección 'Tarifa 1 - R'")
    return cuadros


def bajar_cuadro(periodo: str, id_doc: str) -> list[CuadroEnre]:
    return parse_cuadro(_get(f"{BASE}/{id_doc}?opendocument"), periodo, id_doc)


# ---------------------------------------------------------------------------
# Persistencia
# ---------------------------------------------------------------------------


def leer_salida() -> list[dict]:
    if not SALIDA.exists():
        return []
    return json.loads(SALIDA.read_text(encoding="utf-8"))


def escribir_salida(cuadros: list[dict]) -> None:
    ordenados = sorted(cuadros, key=lambda c: (c["periodo"], c["nivel"]))
    SALIDA.write_text(
        json.dumps(ordenados, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
        # LF explícito: en Windows el default sería CRLF, y entonces cada corrida del scraper
        # en otra plataforma —el Action que va a regenerar esto por cron— produciría un diff
        # de miles de líneas que son solo el fin de línea.
        newline="\n",
    )


def fusionar(existentes: list[dict], nuevos: list[dict]) -> tuple[list[dict], int, int]:
    """Reemplaza por (periodo, nivel). Devuelve (resultado, agregados, cambiados)."""
    indice = {(c["periodo"], c["nivel"]): c for c in existentes}
    agregados = cambiados = 0

    for cuadro in nuevos:
        clave = (cuadro["periodo"], cuadro["nivel"])
        if clave not in indice:
            agregados += 1
        elif indice[clave] != cuadro:
            cambiados += 1
            print(f"  ! {clave[0]} {clave[1]}: cambió respecto de lo que había guardado")
        indice[clave] = cuadro

    return list(indice.values()), agregados, cambiados


# ---------------------------------------------------------------------------
# Autotest
# ---------------------------------------------------------------------------

# Edenor N2 de un período de cada formato. Estos valores están validados contra comprobantes
# reales de MIDE (ver app/domain/casos.ts), así que si el parseo se desvía de acá el scraper
# está roto, no el ENRE.
FIXTURE = {
    # Formato viejo: tres niveles, consumo base en el label ("hasta 350").
    "2025-11": {
        "consumoBaseKwh": 350,
        "bloques": [
            (150, 1356.90, 50.594, 50.594),
            (400, 2894.06, 51.089, 110.133),
            (500, 9503.45, 60.236, 119.281),
            (600, 15203.38, 63.213, 122.258),
            (700, 32044.40, 63.436, 122.481),
            (1400, 49981.63, 75.373, 134.418),
        ],
    },
    # Formato nuevo: con/sin subsidio, consumo base estacional en la nota al pie.
    "2026-07": {
        "consumoBaseKwh": 300,
        "bloques": [
            (150, 1710.71, 69.303, 69.303),
            (400, 3648.68, 69.926, 155.504),
            (500, 11981.48, 81.459, 167.037),
            (600, 19167.67, 85.212, 170.790),
            (700, 40400.01, 85.493, 171.071),
            (1400, 63014.37, 100.542, 186.121),
        ],
    },
}


def check() -> int:
    periodos = dict(listar_periodos())
    fallos = 0

    for periodo, esperado in FIXTURE.items():
        if periodo not in periodos:
            print(f"✗ {periodo}: no está en el índice del ENRE")
            fallos += 1
            continue

        n2 = [c for c in bajar_cuadro(periodo, periodos[periodo]) if c.nivel == "N2"]
        if len(n2) != 1:
            print(f"✗ {periodo}: se esperaba una sección N2, se encontraron {len(n2)}")
            fallos += 1
            continue

        cuadro = n2[0]
        previos = fallos

        if cuadro.consumoBaseKwh != esperado["consumoBaseKwh"]:
            print(
                f"✗ {periodo} consumo base: esperado {esperado['consumoBaseKwh']}, "
                f"obtenido {cuadro.consumoBaseKwh}"
            )
            fallos += 1

        for bloque, tupla in zip(cuadro.bloques, esperado["bloques"]):
            actual = (
                bloque.hastaKwh,
                bloque.cargoFijo,
                bloque.cargoVariableBase,
                bloque.cargoVariableExcedente,
            )
            if actual != tupla:
                print(f"✗ {periodo} bloque ≤{tupla[0]}: esperado {tupla}, obtenido {actual}")
                fallos += 1

        if fallos == previos:
            print(f"✓ {periodo} (Edenor N2, consumo base {cuadro.consumoBaseKwh} kWh)")

    if fallos:
        print(f"\n{fallos} diferencia(s) contra el fixture.")
        return 1
    print("\nLos parsers reproducen los valores validados contra comprobantes.")
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Scraper de cuadros T1-R del ENRE (Edenor).")
    grupo = parser.add_mutually_exclusive_group()
    grupo.add_argument("--todos", action="store_true", help="todos los períodos del índice")
    grupo.add_argument("--periodo", metavar="YYYY-MM", help="un período puntual")
    grupo.add_argument("--check", action="store_true", help="valida los parsers y no escribe")
    args = parser.parse_args()

    if args.check:
        return check()

    disponibles = listar_periodos()

    if args.todos:
        objetivo = disponibles
    elif args.periodo:
        objetivo = [(p, i) for p, i in disponibles if p == args.periodo]
        if not objetivo:
            print(f"El período {args.periodo} no está en el índice del ENRE.", file=sys.stderr)
            return 1
    else:
        # Default: el último cuadro publicado, que es el primero del índice.
        objetivo = disponibles[:1]

    nuevos: list[dict] = []
    for periodo, id_doc in objetivo:
        try:
            cuadros = bajar_cuadro(periodo, id_doc)
        except (ErrorDeFormato, requests.RequestException) as e:
            # Un período con otro formato no debe tumbar la corrida completa: los cuadros
            # más viejos pueden no tener la estructura que estos parsers conocen.
            print(f"  ! {periodo}: {e}", file=sys.stderr)
            continue
        print(f"  {periodo}: {', '.join(sorted(c.nivel for c in cuadros))}")
        nuevos.extend(asdict(c) for c in cuadros)

    if not nuevos:
        print("No se pudo extraer ningún cuadro.", file=sys.stderr)
        return 1

    resultado, agregados, cambiados = fusionar(leer_salida(), nuevos)
    escribir_salida(resultado)
    print(f"\n{SALIDA.name}: {len(resultado)} cuadros ({agregados} nuevos, {cambiados} actualizados)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
