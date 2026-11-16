import { OpticalMapItem, OpticalNodeRole, OpticalPipeType } from '../types';

/**
 * Symbols of the optical map. They are plain SVG strings because Leaflet
 * markers take HTML, and the legend renders the very same strings.
 */

export type SymbolColors = {
  fill: string;
  stroke: string;
};

const VIEW_BOX = 28;
const STROKE_WIDTH = 2.5;

const SQUARE = `<rect x="3.5" y="3.5" width="21" height="21" rx="3"/>`;
const HEXAGON = `<polygon points="14,2 24.5,8 24.5,20 14,26 3.5,20 3.5,8"/>`;

/**
 * One shape per `OpticalNodeRole`. The combined roles nest the line-system
 * shape (circle = ROADM, diamond = FOADM) inside the transponder square.
 */
const nodeShape = (role: string | null, { stroke }: SymbolColors): string => {
  const solid = `fill="${stroke}" stroke="none"`;
  switch (role) {
    case OpticalNodeRole.ROADM:
      return `<circle cx="14" cy="14" r="10.5"/>`;
    case OpticalNodeRole.FOADM:
      return `<polygon points="14,2 26,14 14,26 2,14"/>`;
    case OpticalNodeRole.AMPLIFIER:
      return `<polygon points="4,3 26,14 4,25"/>`;
    case OpticalNodeRole.TRANSPONDER:
      return SQUARE;
    case OpticalNodeRole.TRANSPONDER_ROADM:
      return `${SQUARE}<circle cx="14" cy="14" r="5.5" ${solid}/>`;
    case OpticalNodeRole.TRANSPONDER_FOADM:
      return `${SQUARE}<polygon points="14,7 21,14 14,21 7,14" ${solid}/>`;
    case OpticalNodeRole.IPODWDM:
      return HEXAGON;
    default:
      return `<circle cx="14" cy="14" r="7" stroke-dasharray="3 2.5"/>`;
  }
};

export const nodeSymbolSvg = (role: string | null, colors: SymbolColors, size = 28): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${VIEW_BOX} ${VIEW_BOX}" ` +
  `fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round" ` +
  `aria-hidden="true">${nodeShape(role, colors)}</svg>`;

export type LineStyle = {
  color: string;
  weight: number;
  /** SVG dash pattern; undefined for a solid line. */
  dashArray?: string;
};

export type LinePalette = {
  span: string;
  patch: string;
  leasedSpectrum: string;
  /** Colours handed out in turn to spectrums and digital services. */
  categorical: string[];
  /** Pipes drawn as context underneath the services. */
  underlay: string;
};

/** One stroke per `OpticalPipeType`: colour and dash pattern both differ. */
export const pipeLineStyle = (pipeType: string | undefined, palette: LinePalette): LineStyle => {
  switch (pipeType) {
    case OpticalPipeType.SPAN:
      return { color: palette.span, weight: 4 };
    case OpticalPipeType.PATCH:
      return { color: palette.patch, weight: 3, dashArray: '5 6' };
    case OpticalPipeType.LEASED_SPECTRUM:
      return { color: palette.leasedSpectrum, weight: 4, dashArray: '12 7' };
    default:
      return { color: palette.underlay, weight: 3, dashArray: '1 5' };
  }
};

export const itemLineStyle = (
  item: OpticalMapItem,
  index: number,
  palette: LinePalette,
): LineStyle => {
  if (item.kind === 'pipe') return pipeLineStyle(item.pipeType, palette);
  return {
    color: palette.categorical[index % palette.categorical.length],
    weight: 4,
    // Once the colours have all been used, a second and third round stay distinguishable by their dashes.
    dashArray: [undefined, '10 6', '3 6'][Math.floor(index / palette.categorical.length) % 3],
  };
};

export const lineSymbolSvg = (style: LineStyle, width = 34, height = 12): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ` +
  `aria-hidden="true"><line x1="2" y1="${height / 2}" x2="${width - 2}" y2="${height / 2}" stroke="${style.color}" ` +
  `stroke-width="${style.weight}" stroke-linecap="round"` +
  `${style.dashArray ? ` stroke-dasharray="${style.dashArray}"` : ''}/></svg>`;
