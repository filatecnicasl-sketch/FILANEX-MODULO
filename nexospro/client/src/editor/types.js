export const PAGE_SIZES_MM = {
  A4: [210, 297],
  A5: [148, 210],
  Letter: [216, 279],
};

export function pageDimensions(page) {
  const [w, h] = PAGE_SIZES_MM[page.size] ?? PAGE_SIZES_MM.A4;
  return page.orientation === "landscape" ? { w: h, h: w } : { w, h };
}
