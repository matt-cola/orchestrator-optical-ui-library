import React, { CSSProperties, FC, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import {
  EuiButtonGroup,
  EuiCallOut,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiSwitch,
  useEuiTheme,
} from '@elastic/eui';

import {
  OPTICAL_NODE_ROLES,
  OPTICAL_PIPE_TYPES,
  OpticalMapItem,
  OpticalMapLayer,
  OpticalTopology,
} from '../types';
import { OpticalMapStatus } from './OpticalMapPopups';
import { OpticalMapStyles } from './OpticalMapStyles';
import {
  LinePalette,
  LineStyle,
  SymbolColors,
  itemLineStyle,
  lineSymbolSvg,
  nodeSymbolSvg,
  pipeLineStyle,
} from './opticalMapSymbols';

// Leaflet touches `window` when it is imported, so it is only loaded in the browser.
const WfoOpticalLeafletMap = dynamic(() => import('./WfoOpticalLeafletMap'), { ssr: false });

export const DEFAULT_TILE_LAYER_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const DEFAULT_TILE_LAYER_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export type OpticalMapLabels = {
  layerLegend: string;
  layers: Record<OpticalMapLayer, string>;
  nodeLabels: string;
  legendNodes: string;
  legendLines: string;
  legendPipe: string;
  legendColourPerItem: Record<Exclude<OpticalMapLayer, OpticalMapLayer.PIPES>, string>;
  empty: Record<OpticalMapLayer, string>;
  notOnMap: string;
  unplacedNodes: (count: number) => string;
};

export const DEFAULT_OPTICAL_MAP_LABELS: OpticalMapLabels = {
  layerLegend: 'Map layer',
  layers: {
    [OpticalMapLayer.PIPES]: 'Optical pipes',
    [OpticalMapLayer.SPECTRUM]: 'Optical spectrum',
    [OpticalMapLayer.DIGITAL_SERVICES]: 'Digital services',
  },
  nodeLabels: 'Node names',
  legendNodes: 'Optical nodes',
  legendLines: 'Lines',
  legendPipe: 'Optical pipe',
  legendColourPerItem: {
    [OpticalMapLayer.SPECTRUM]: 'One colour per spectrum',
    [OpticalMapLayer.DIGITAL_SERVICES]: 'One colour per service',
  },
  empty: {
    [OpticalMapLayer.PIPES]: 'No optical pipes found.',
    [OpticalMapLayer.SPECTRUM]: 'No optical spectrum found.',
    [OpticalMapLayer.DIGITAL_SERVICES]: 'No optical digital services found.',
  },
  notOnMap: 'Not on the map: an end has no coordinates',
  unplacedNodes: (count) =>
    `${count} optical ${count === 1 ? 'node is' : 'nodes are'} not shown because the location has no valid coordinates.`,
};

export type WfoOpticalMapProps = {
  topology: OpticalTopology;
  defaultLayer?: OpticalMapLayer;
  /** CSS height of the map. */
  height?: CSSProperties['height'];
  tileLayerUrl?: string;
  tileLayerAttribution?: string;
  /** Link target of a subscription. Defaults to the subscription detail page of the orchestrator UI. */
  getSubscriptionUrl?: (subscriptionId: string) => string;
  labels?: Partial<OpticalMapLabels>;
};

const defaultGetSubscriptionUrl = (subscriptionId: string) => `/subscriptions/${subscriptionId}`;

const Svg: FC<{ svg: string }> = ({ svg }) => <span dangerouslySetInnerHTML={{ __html: svg }} />;

export const WfoOpticalMap: FC<WfoOpticalMapProps> = ({
  topology,
  defaultLayer = OpticalMapLayer.PIPES,
  height = 'calc(100vh - 260px)',
  tileLayerUrl = DEFAULT_TILE_LAYER_URL,
  tileLayerAttribution = DEFAULT_TILE_LAYER_ATTRIBUTION,
  getSubscriptionUrl = defaultGetSubscriptionUrl,
  labels: labelOverrides,
}) => {
  const { euiTheme, colorMode } = useEuiTheme();
  const labels = { ...DEFAULT_OPTICAL_MAP_LABELS, ...labelOverrides };

  const [layer, setLayer] = useState<OpticalMapLayer>(defaultLayer);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showNodeLabels, setShowNodeLabels] = useState(false);

  const { colors } = euiTheme;
  const symbolColors: SymbolColors = useMemo(
    () => ({ fill: colors.backgroundBasePlain, stroke: colors.textParagraph }),
    [colors.backgroundBasePlain, colors.textParagraph],
  );
  const palette: LinePalette = useMemo(
    () => ({
      span: colors.vis.euiColorVis0,
      patch: colors.vis.euiColorVis6,
      leasedSpectrum: colors.vis.euiColorVis2,
      categorical: [
        colors.vis.euiColorVis0,
        colors.vis.euiColorVis6,
        colors.vis.euiColorVis2,
        colors.vis.euiColorVis8,
        colors.vis.euiColorVis4,
        colors.vis.euiColorVis1,
        colors.vis.euiColorVis7,
        colors.vis.euiColorVis3,
        colors.vis.euiColorVis9,
        colors.vis.euiColorVis5,
      ],
      underlay: colors.textSubdued,
    }),
    [colors],
  );

  const items: OpticalMapItem[] = {
    [OpticalMapLayer.PIPES]: topology.pipes,
    [OpticalMapLayer.SPECTRUM]: topology.spectrums,
    [OpticalMapLayer.DIGITAL_SERVICES]: topology.digitalServices,
  }[layer];

  const itemStyles = useMemo(
    () =>
      new Map<string, LineStyle>(
        items.map((item, index) => [item.id, itemLineStyle(item, index, palette)]),
      ),
    [items, palette],
  );
  const underlayStyle: LineStyle = useMemo(
    () => ({ color: palette.underlay, weight: 2 }),
    [palette],
  );

  const placedNodeIds = useMemo(
    () => new Set(topology.nodes.filter((node) => node.location).map((node) => node.id)),
    [topology.nodes],
  );
  const unplacedNodeCount = topology.nodes.length - placedNodeIds.size;
  const isOnMap = (item: OpticalMapItem) =>
    item.routes.length > 0 &&
    item.routes.every((route) => route.every((nodeId) => placedNodeIds.has(nodeId)));

  const rolesInUse = new Set(topology.nodes.map((node) => node.role));
  const legendRoles = [
    ...OPTICAL_NODE_ROLES,
    ...[...rolesInUse].filter((role) => !OPTICAL_NODE_ROLES.includes(role as never)),
  ];

  const selectLayer = (id: string) => {
    setLayer(id as OpticalMapLayer);
    setSelectedItemId(null);
  };

  const themeVariables = {
    '--wom-bg': colors.backgroundBasePlain,
    '--wom-bg-subdued': colors.backgroundBaseSubdued,
    '--wom-text': colors.textParagraph,
    '--wom-subdued': colors.textSubdued,
    '--wom-border': colors.borderBaseSubdued,
    '--wom-primary': colors.textPrimary,
    '--wom-success': colors.textSuccess,
    '--wom-warning': colors.textWarning,
    '--wom-danger': colors.textDanger,
    height,
    minHeight: 420,
  } as CSSProperties;

  return (
    <>
      <OpticalMapStyles />
      <EuiFlexGroup alignItems="center" gutterSize="l" wrap responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiButtonGroup
            legend={labels.layerLegend}
            options={Object.values(OpticalMapLayer).map((id) => ({ id, label: labels.layers[id] }))}
            idSelected={layer}
            onChange={selectLayer}
            color="primary"
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiSwitch
            label={labels.nodeLabels}
            checked={showNodeLabels}
            onChange={(event) => setShowNodeLabels(event.target.checked)}
            compressed
          />
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      {unplacedNodeCount > 0 && (
        <>
          <EuiCallOut
            size="s"
            color="warning"
            iconType="warning"
            title={labels.unplacedNodes(unplacedNodeCount)}
          />
          <EuiSpacer size="m" />
        </>
      )}
      <div
        className={`wfo-optical-map${colorMode === 'DARK' ? ' wfo-optical-map--dark' : ''}`}
        style={themeVariables}
        data-testid="wfo-optical-map"
      >
        <div className="wfo-optical-map__main">
          <WfoOpticalLeafletMap
            nodes={topology.nodes}
            items={items}
            itemStyles={itemStyles}
            underlay={layer === OpticalMapLayer.PIPES ? [] : topology.pipes}
            underlayStyle={underlayStyle}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            showNodeLabels={showNodeLabels}
            symbolColors={symbolColors}
            siteColor={colors.textSubdued}
            tileLayerUrl={tileLayerUrl}
            tileLayerAttribution={tileLayerAttribution}
            getSubscriptionUrl={getSubscriptionUrl}
          />
          <div className="wfo-optical-map__legend">
            <h4>{labels.legendNodes}</h4>
            <ul>
              {legendRoles.map((role) => (
                <li key={role ?? 'unknown'}>
                  <Svg svg={nodeSymbolSvg(role, symbolColors, 18)} />
                  <span>{role ?? 'Unknown role'}</span>
                </li>
              ))}
            </ul>
            <h4>{labels.legendLines}</h4>
            <ul>
              {layer === OpticalMapLayer.PIPES ? (
                OPTICAL_PIPE_TYPES.map((pipeType) => (
                  <li key={pipeType}>
                    <Svg svg={lineSymbolSvg(pipeLineStyle(pipeType, palette))} />
                    <span>{pipeType}</span>
                  </li>
                ))
              ) : (
                <>
                  <li>
                    <Svg svg={lineSymbolSvg({ color: palette.categorical[0], weight: 4 })} />
                    <span>{labels.legendColourPerItem[layer]}</span>
                  </li>
                  <li>
                    <Svg svg={lineSymbolSvg(underlayStyle)} />
                    <span>{labels.legendPipe}</span>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
        <div className="wfo-optical-map__panel">
          <div className="wfo-optical-map__panel-header">
            {labels.layers[layer]}
            <small>{items.length}</small>
          </div>
          {items.length === 0 ? (
            <div className="wfo-optical-map__list-empty">{labels.empty[layer]}</div>
          ) : (
            <ul className="wfo-optical-map__list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selectedItemId === item.id}
                    onClick={() => setSelectedItemId(selectedItemId === item.id ? null : item.id)}
                  >
                    <span className="wfo-optical-map__list-swatch">
                      <Svg svg={lineSymbolSvg(itemStyles.get(item.id) ?? underlayStyle)} />
                    </span>
                    <span className="wfo-optical-map__list-text">
                      <span className="wfo-optical-map__list-label">{item.label}</span>
                      {item.sublabel && (
                        <span className="wfo-optical-map__list-sublabel">{item.sublabel}</span>
                      )}
                      {!isOnMap(item) && (
                        <span className="wfo-optical-map__list-note">{labels.notOnMap}</span>
                      )}
                      <OpticalMapStatus subscription={item.subscription} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};
