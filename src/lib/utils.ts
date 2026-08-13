// file: src/lib/utils.ts

/**
 * Progressive logo swap: reveals an <img> and hides an <svg> placeholder
 * once the image has loaded. If the image is already cached, the swap
 * happens immediately.
 */
export function setLogo(
  logoUrl: string,
  imgId: string = "logo-img",
  svgId: string = "logo-svg",
): void {
  const logoImg = document.getElementById(imgId) as HTMLImageElement | null;
  const logoSvg = document.getElementById(svgId) as SVGSVGElement | null;

  if (!logoImg || !logoSvg) return;

  const reveal = (): void => {
    logoImg.classList.remove("hidden");
    logoSvg.classList.add("hidden");
  };

  logoImg.addEventListener("load", reveal, { once: true });
  logoImg.src = logoUrl;

  // If the image is already in cache, `load` may never fire.
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    reveal();
  }
}
