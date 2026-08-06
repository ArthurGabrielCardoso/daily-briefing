import { z } from 'zod';

/** Where a block sits inside a matéria's layout. */
export const slotSchema = z.enum(['top', 'inline', 'aside', 'bottom']);

export const fonteSchema = z.object({
  nome: z.string(),
  url: z.string(),
});

export const svgNameSchema = z.enum(['perimetro', 'bars', 'trend']);

/** Discriminated union used for cover art and radar thumbnails. */
export const mediaBlockSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('photo'),
    src: z.string(),
    alt: z.string(),
    credito: z.string(),
  }),
  z.object({
    kind: z.literal('video'),
    youtubeId: z.string(),
    start: z.number().optional(),
    legenda: z.string(),
  }),
  z.object({
    kind: z.literal('svg'),
    name: svgNameSchema,
    legenda: z.string().optional(),
  }),
  z.object({
    kind: z.literal('logo'),
    src: z.string(),
    alt: z.string(),
  }),
]);

/** Caption fragment that supports a single leading bold run. */
export const captionSchema = z.object({
  strong: z.string().optional(),
  text: z.string(),
});

const blockBase = {
  /** Layout slot. Defaults to 'inline'. */
  slot: slotSchema.optional(),
  /**
   * For inline blocks: render right after this paragraph index.
   * -1 places the block before the first paragraph.
   */
  afterParagraph: z.number().optional(),
};

/** Rich blocks that can be composed into a matéria. */
export const blockSchema = z.discriminatedUnion('kind', [
  z.object({
    ...blockBase,
    kind: z.literal('megaNumber'),
    numero: z.string(),
    label: z.string(),
    de: z.string().optional(),
  }),
  z.object({
    ...blockBase,
    kind: z.literal('statCard'),
    numero: z.string(),
    label: z.string(),
  }),
  z.object({
    ...blockBase,
    kind: z.literal('conceptBox'),
    termo: z.string(),
    texto: z.string(),
  }),
  z.object({
    ...blockBase,
    kind: z.literal('editorialImage'),
    src: z.string(),
    alt: z.string(),
    height: z.number(),
    caption: captionSchema,
    /** Extra bottom margin, matching the original spacer div. */
    marginBottom: z.number().optional(),
  }),
  z.object({
    ...blockBase,
    kind: z.literal('svgHero'),
    name: svgNameSchema,
    legenda: z.string().optional(),
  }),
  z.object({
    ...blockBase,
    kind: z.literal('videoEmbed'),
    youtubeId: z.string(),
    start: z.number().optional(),
    legenda: z.string(),
  }),
  z.object({
    ...blockBase,
    kind: z.literal('barChart'),
    rows: z.array(
      z.object({
        label: z.string(),
        valor: z.number(),
        texto: z.string(),
        cor: z.enum(['copilot-before', 'copilot-after', 'cursor', 'claude']),
      })
    ),
    nota: z.string().optional(),
  }),
]);

export const tagSchema = z.enum(['essencial', 'importante', 'acompanhar', 'curiosidade']);

export const variantSchema = z.enum([
  'dark-number',
  'side-image',
  'image-video',
  'dark-chart',
]);

export const materiaSchema = z.object({
  id: z.string(),
  tag: tagSchema,
  variant: variantSchema,
  titulo: z.string(),
  /** Each item becomes a clickable read block. */
  paragrafos: z.array(z.string()),
  blocks: z.array(blockSchema).optional(),
  /** Shows the "toque em qualquer parágrafo" affordance under the body. */
  readHint: z.boolean().optional(),
  fonte: fonteSchema,
});

export const radarItemSchema = z.object({
  categoria: z.string(),
  titulo: z.string(),
  texto: z.string(),
  thumb: mediaBlockSchema,
  fonte: fonteSchema,
});

export const briefingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekday: z.string(),
  stats: z.object({
    destaques: z.number(),
  }),
  seuDia: z.object({
    agenda: z.string(),
    alerta: z.string().optional(),
  }),
  capa: z.object({
    eyebrow: z.string(),
    headline: z.string(),
    sub: z.string(),
    frase: z.string(),
    media: mediaBlockSchema,
    fonte: fonteSchema,
  }),
  materias: z.array(materiaSchema),
  radar: z.array(radarItemSchema),
  encerramento: z.object({
    ideiaPrincipal: z.string(),
    conceito: z.string(),
    reflexao: z.string(),
    assinatura: z.string(),
  }),
});

export type Fonte = z.infer<typeof fonteSchema>;
export type MediaBlock = z.infer<typeof mediaBlockSchema>;
export type Caption = z.infer<typeof captionSchema>;
export type Block = z.infer<typeof blockSchema>;
export type Slot = z.infer<typeof slotSchema>;
export type SvgName = z.infer<typeof svgNameSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type Materia = z.infer<typeof materiaSchema>;
export type RadarItem = z.infer<typeof radarItemSchema>;
export type Briefing = z.infer<typeof briefingSchema>;

export function parseBriefing(input: unknown): Briefing {
  return briefingSchema.parse(input);
}

/** Blocks assigned to a given slot, in declaration order. */
export function blocksIn(blocks: Block[] | undefined, slot: Slot): Block[] {
  if (!blocks) return [];
  return blocks.filter((b) => (b.slot ?? 'inline') === slot);
}

/** Inline blocks that follow a given paragraph index (-1 = before the first). */
export function blocksAfter(blocks: Block[] | undefined, index: number): Block[] {
  return blocksIn(blocks, 'inline').filter((b) => (b.afterParagraph ?? -1) === index);
}
