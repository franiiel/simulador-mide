# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=11"]
# ///
"""Genera los iconos de la app en `app/assets/`.

La marca es el monograma M en Archivo Black —la tipografía de la app— sobre el fondo oscuro
del tema, con la rampa de precios como base.

    uv run scripts/iconos.py

La fuente se toma de `node_modules`, así que hace falta haber corrido `pnpm install` en `app/`.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

APP = Path(__file__).resolve().parents[1] / "app"
FUENTE = APP / "node_modules/@expo-google-fonts/archivo/900Black/Archivo_900Black.ttf"
ASSETS = APP / "assets"

# Tokens de app/ui/theme.ts (paleta oscura). Si cambian allá, cambian acá.
FONDO = (14, 16, 19, 255)
TINTA = (243, 244, 246, 255)
RAMPA = ["#60A5FA", "#A78BFA", "#F472B6", "#FB7A5F"]

# Proporciones del bloque, relativas al alto de la M.
HUECO = 0.17
GROSOR_BARRA = 0.12


def rgb(hexa: str) -> tuple[int, int, int]:
    n = int(hexa[1:], 16)
    return (n >> 16) & 255, (n >> 8) & 255, n & 255


def eme(alto: int) -> Image.Image:
    """La M recortada a su tinta, sin el margen tipográfico, al alto pedido."""
    fuente = ImageFont.truetype(str(FUENTE), 1400)
    lienzo = Image.new("RGBA", (2400, 2400), (0, 0, 0, 0))
    ImageDraw.Draw(lienzo).text((1200, 1200), "M", font=fuente, fill=TINTA, anchor="mm")
    recorte = lienzo.crop(lienzo.getbbox())
    ancho = round(recorte.width * alto / recorte.height)
    return recorte.resize((ancho, alto), Image.LANCZOS)


def barra(ancho: int, alto: int, plana: bool) -> Image.Image:
    """La rampa de precios: de barato a caro, con los extremos redondeados."""
    grad = Image.new("RGBA", (ancho, alto), (0, 0, 0, 0))
    pintar = ImageDraw.Draw(grad)
    anclas = [rgb(c) for c in RAMPA]
    for x in range(ancho):
        if plana:
            color = TINTA
        else:
            t = (x / max(ancho - 1, 1)) * (len(anclas) - 1)
            i = min(int(t), len(anclas) - 2)
            f = t - i
            color = tuple(
                round(anclas[i][c] + (anclas[i + 1][c] - anclas[i][c]) * f) for c in range(3)
            ) + (255,)
        pintar.line([(x, 0), (x, alto)], fill=color)

    mascara = Image.new("L", (ancho, alto), 0)
    ImageDraw.Draw(mascara).rounded_rectangle(
        [0, 0, ancho - 1, alto - 1], radius=alto // 2, fill=255
    )
    grad.putalpha(mascara)
    return grad


def marca(lienzo: int, alto_m: int, fondo, radio: int = 0, plana: bool = False) -> Image.Image:
    img = Image.new("RGBA", (lienzo, lienzo), (0, 0, 0, 0))
    if fondo is not None:
        capa = Image.new("RGBA", (lienzo, lienzo), fondo)
        if radio:
            mascara = Image.new("L", (lienzo, lienzo), 0)
            ImageDraw.Draw(mascara).rounded_rectangle(
                [0, 0, lienzo - 1, lienzo - 1], radius=radio, fill=255
            )
            capa.putalpha(mascara)
        img.alpha_composite(capa)

    m = eme(alto_m)
    alto_barra = max(round(alto_m * GROSOR_BARRA), 2)
    hueco = round(alto_m * HUECO)
    b = barra(m.width, alto_barra, plana)

    total = m.height + hueco + alto_barra
    x = (lienzo - m.width) // 2
    y = (lienzo - total) // 2
    img.alpha_composite(m, (x, y))
    img.alpha_composite(b, (x, y + m.height + hueco))
    return img


def main() -> None:
    # Icono completo: cada sistema le aplica su propia máscara, así que el fondo va a sangre.
    marca(1024, 512, FONDO).save(ASSETS / "icon.png")

    # Adaptativo de Android: del lienzo solo se ve el 72/108 central y apenas el 66/108 está
    # garantizado. Por eso la marca se dimensiona contra el área visible y no contra el lienzo:
    # con el mismo alto que `icon.png` quedaría recortada.
    marca(1024, 342, None).save(ASSETS / "android-icon-foreground.png")
    Image.new("RGBA", (1024, 1024), FONDO).save(ASSETS / "android-icon-background.png")

    # Monocromo (iconos temáticos): el sistema descarta el color y usa solo el alfa, así que la
    # rampa se dibuja plana —con el degradado, la barra saldría igual pero sin significar nada.
    marca(1024, 342, None, plana=True).save(ASSETS / "android-icon-monochrome.png")

    # Favicon: el navegador no lo enmascara, las esquinas redondeadas van dibujadas.
    marca(256, 118, FONDO, radio=56).save(ASSETS / "favicon.png")

    for nombre in sorted(p.name for p in ASSETS.glob("*.png")):
        print(f"  {nombre}")


if __name__ == "__main__":
    main()
