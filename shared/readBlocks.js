/**
 * The narration sequence of an edition, in document order: the cover lede first,
 * then every paragraph of every matéria.
 *
 * Shared by the browser (highlighting, click-to-read) and the server (audio
 * generation) so the two can never disagree about which block is index N —
 * a mismatch would make the wrong paragraph light up mid-narration.
 *
 * @param {{ capa: { sub: string }, materias: { paragrafos: string[] }[] }} briefing
 * @returns {string[]}
 */
export function readBlocksOf(briefing) {
  const blocks = [briefing.capa.sub];
  for (const materia of briefing.materias) blocks.push(...materia.paragrafos);
  return blocks;
}

/**
 * Global reading index of each matéria's first paragraph. Index 0 is the cover
 * lede, so the first matéria starts at 1.
 *
 * @param {{ materias: { paragrafos: string[] }[] }} briefing
 * @returns {number[]}
 */
export function materiaOffsets(briefing) {
  let next = 1;
  return briefing.materias.map((materia) => {
    const start = next;
    next += materia.paragrafos.length;
    return start;
  });
}
