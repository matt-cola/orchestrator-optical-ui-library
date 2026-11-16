import React, { FC, useEffect, useMemo, useState } from 'react';

import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';

import {
  NODE_SPACING_PX,
  Point,
  colocatedOffsets,
  colocatedRadius,
  curvePoints,
  layoutSegments,
  loopPoints,
} from '../topology/layout';
import { OpticalMapItem, OpticalNode } from '../types';
import { OpticalMapItemPopup, OpticalMapNodePopup } from './OpticalMapPopups';
import { LineStyle, SymbolColors, nodeSymbolSvg } from './opticalMapSymbols';

/**
 * The Leaflet part of the optical map. Leaflet needs `window`, so this module
 * must only be loaded in the browser: `WfoOpticalMap` imports it dynamically.
 */

export type WfoOpticalLeafletMapProps = {
  nodes: OpticalNode[];
  /** Items of the selected layer. */
  items: OpticalMapItem[];
  itemStyles: Map<string, LineStyle>;
  /** Pipes drawn faintly underneath the items, as context. */
  underlay: OpticalMapItem[];
  underlayStyle: LineStyle;
  selectedItemId: string | null;
  onSelectItem: (itemId: string | null) => void;
  showNodeLabels: boolean;
  symbolColors: SymbolColors;
  siteColor: string;
  tileLayerUrl: string;
  tileLayerAttribution: string;
  getSubscriptionUrl: (subscriptionId: string) => string;
};

const NODE_ICON_SIZE = 28;
const DEFAULT_CENTER: L.LatLngExpression = [48, 10];
const DEFAULT_ZOOM = 4;
const MAX_FIT_ZOOM = 12;
const MIN_ZOOM = 2;
const FIT_PADDING_PX = 70;

type LabelDirection = 'top' | 'bottom' | 'left' | 'right';

/** Node names point away from the centre of their location, so the names of co-located nodes do not pile up. */
const labelPlacement = ({
  x,
  y,
}: Point): { direction: LabelDirection; offset: [number, number] } => {
  const distance = NODE_ICON_SIZE / 2;
  if (Math.abs(x) > Math.abs(y)) {
    return x < 0
      ? { direction: 'left', offset: [-distance, 0] }
      : { direction: 'right', offset: [distance, 0] };
  }
  return y > 0
    ? { direction: 'bottom', offset: [0, distance] }
    : { direction: 'top', offset: [0, -distance] };
};

type Site = {
  key: string;
  label: string;
  latLng: L.LatLng;
  nodes: OpticalNode[];
  radius: number;
};

const groupBySite = (nodes: OpticalNode[]): Site[] => {
  const sites = new Map<string, Site>();
  for (const node of nodes) {
    if (!node.location) continue;
    const { latitude, longitude, code, name } = node.location;
    const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    const site = sites.get(key) ?? {
      key,
      label: code ?? name ?? '',
      latLng: L.latLng(latitude, longitude),
      nodes: [],
      radius: 0,
    };
    site.nodes.push(node);
    site.radius = colocatedRadius(site.nodes.length, NODE_SPACING_PX);
    sites.set(key, site);
  }
  return [...sites.values()];
};

type TopologyLayersProps = Omit<WfoOpticalLeafletMapProps, 'tileLayerUrl' | 'tileLayerAttribution'>;

const TopologyLayers: FC<TopologyLayersProps> = ({
  nodes,
  items,
  itemStyles,
  underlay,
  underlayStyle,
  selectedItemId,
  onSelectItem,
  showNodeLabels,
  symbolColors,
  siteColor,
  getSubscriptionUrl,
}) => {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    click: () => onSelectItem(null),
  });

  const sites = useMemo(() => groupBySite(nodes), [nodes]);

  // Pixel position of every placed node at the current zoom level.
  const { nodePoints, nodeDirections } = useMemo(() => {
    const points = new Map<string, Point>();
    const directions = new Map<string, Point>();
    for (const site of sites) {
      const origin = map.project(site.latLng, zoom);
      const offsets = colocatedOffsets(site.nodes.length, NODE_SPACING_PX);
      site.nodes.forEach((node, index) => {
        points.set(node.id, { x: origin.x + offsets[index].x, y: origin.y + offsets[index].y });
        directions.set(node.id, offsets[index]);
      });
    }
    return { nodePoints: points, nodeDirections: directions };
  }, [map, sites, zoom]);

  const toLatLng = (point: Point): L.LatLng => map.unproject([point.x, point.y], zoom);

  const toLines = (source: OpticalMapItem[]) =>
    layoutSegments(source, (nodeId) => nodePoints.has(nodeId)).map((segment) => {
      const from = nodePoints.get(segment.from)!;
      const to = nodePoints.get(segment.to)!;
      const points =
        segment.from === segment.to
          ? loopPoints(
              from,
              nodeDirections.get(segment.from) ?? { x: 0, y: -1 },
              13 + segment.loopIndex * 5,
            )
          : curvePoints(from, to, segment.offset);
      return { itemId: segment.itemId, positions: points.map(toLatLng) };
    });

  const itemLines = useMemo(() => toLines(items), [items, nodePoints]); // eslint-disable-line react-hooks/exhaustive-deps
  const underlayLines = useMemo(() => toLines(underlay), [underlay, nodePoints]); // eslint-disable-line react-hooks/exhaustive-deps
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const icons = useMemo(() => {
    const byRole = new Map<string, L.DivIcon>();
    return (role: string | null) => {
      const key = role ?? '';
      if (!byRole.has(key)) {
        byRole.set(
          key,
          L.divIcon({
            className: 'wfo-optical-map__node',
            html: nodeSymbolSvg(role, symbolColors, NODE_ICON_SIZE),
            iconSize: [NODE_ICON_SIZE, NODE_ICON_SIZE],
            iconAnchor: [NODE_ICON_SIZE / 2, NODE_ICON_SIZE / 2],
            popupAnchor: [0, -NODE_ICON_SIZE / 2],
          }),
        );
      }
      return byRole.get(key)!;
    };
  }, [symbolColors]);

  // Frame the network whenever the set of placed nodes changes.
  const placedNodesKey = sites.map((site) => site.key).join(';');
  useEffect(() => {
    if (sites.length === 0) return;
    map.fitBounds(L.latLngBounds(sites.map((site) => site.latLng)), {
      padding: [FIT_PADDING_PX, FIT_PADDING_PX],
      maxZoom: MAX_FIT_ZOOM,
    });
  }, [map, placedNodesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring a selected item into view when it is (partly) outside the viewport.
  useEffect(() => {
    const item = selectedItemId ? itemsById.get(selectedItemId) : undefined;
    if (!item) return;
    const nodeIds = new Set(item.routes.flat());
    const latLngs = sites
      .filter((site) => site.nodes.some((node) => nodeIds.has(node.id)))
      .map((site) => site.latLng);
    if (latLngs.length === 0) return;
    const bounds = L.latLngBounds(latLngs);
    if (!map.getBounds().contains(bounds)) {
      map.fitBounds(bounds.pad(0.4), { maxZoom: Math.max(map.getZoom(), MAX_FIT_ZOOM) });
    }
  }, [map, selectedItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {sites.map((site) => {
        const origin = map.project(site.latLng, zoom);
        const ring = site.nodes.length > 1 ? site.radius + NODE_ICON_SIZE : 0;
        return (
          <React.Fragment key={site.key}>
            {ring > 0 && (
              <CircleMarker
                center={site.latLng}
                radius={ring}
                interactive={false}
                pathOptions={{
                  color: siteColor,
                  weight: 1,
                  fillColor: siteColor,
                  fillOpacity: 0.08,
                }}
              />
            )}
            {site.label && (
              <Marker
                position={toLatLng({
                  x: origin.x,
                  y: origin.y + Math.max(ring, NODE_ICON_SIZE / 2) + (showNodeLabels ? 26 : 4),
                })}
                interactive={false}
                keyboard={false}
                icon={L.divIcon({
                  className: 'wfo-optical-map__site-label',
                  html: `<span>${escapeHtml(site.label)}</span>`,
                  iconSize: [0, 0],
                })}
              />
            )}
          </React.Fragment>
        );
      })}

      {underlayLines.map((line, index) => (
        <Polyline
          key={`underlay-${line.itemId}-${index}`}
          positions={line.positions}
          interactive={false}
          pathOptions={{ ...underlayStyle, opacity: 0.55, lineCap: 'round' }}
        />
      ))}

      {itemLines.map((line, index) => {
        const item = itemsById.get(line.itemId)!;
        const style = itemStyles.get(line.itemId) ?? underlayStyle;
        const isSelected = selectedItemId === line.itemId;
        const isHovered = hoveredItemId === line.itemId;
        const isDimmed = selectedItemId !== null && !isSelected;
        return (
          <React.Fragment key={`item-${line.itemId}-${index}`}>
            <Polyline
              positions={line.positions}
              interactive={false}
              pathOptions={{
                color: style.color,
                dashArray: style.dashArray,
                weight: style.weight + (isSelected || isHovered ? 2 : 0),
                opacity: isDimmed ? 0.2 : 1,
                lineCap: 'round',
              }}
            />
            {/* A wide invisible line makes the thin one easy to hit. */}
            <Polyline
              positions={line.positions}
              bubblingMouseEvents={false}
              pathOptions={{ color: style.color, weight: 16, opacity: 0 }}
              eventHandlers={{
                click: () => onSelectItem(line.itemId),
                mouseover: () => setHoveredItemId(line.itemId),
                mouseout: () => setHoveredItemId(null),
              }}
            >
              <Tooltip sticky>{item.label}</Tooltip>
              <Popup>
                <OpticalMapItemPopup item={item} getSubscriptionUrl={getSubscriptionUrl} />
              </Popup>
            </Polyline>
          </React.Fragment>
        );
      })}

      {sites.flatMap((site) =>
        site.nodes.map((node) => {
          const label = labelPlacement(nodeDirections.get(node.id) ?? { x: 0, y: 0 });
          return (
            <Marker
              key={node.id}
              position={toLatLng(nodePoints.get(node.id)!)}
              icon={icons(node.role)}
            >
              <Tooltip
                key={`${showNodeLabels ? 'permanent' : 'hover'}-${label.direction}`}
                permanent={showNodeLabels}
                direction={label.direction}
                offset={label.offset}
              >
                {node.name}
              </Tooltip>
              <Popup>
                <OpticalMapNodePopup node={node} getSubscriptionUrl={getSubscriptionUrl} />
              </Popup>
            </Marker>
          );
        }),
      )}
    </>
  );
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const WfoOpticalLeafletMap: FC<WfoOpticalLeafletMapProps> = ({
  tileLayerUrl,
  tileLayerAttribution,
  ...layers
}) => (
  <MapContainer
    center={DEFAULT_CENTER}
    zoom={DEFAULT_ZOOM}
    className="wfo-optical-map__leaflet"
    minZoom={MIN_ZOOM}
    worldCopyJump
  >
    <TileLayer url={tileLayerUrl} attribution={tileLayerAttribution} />
    <TopologyLayers {...layers} />
  </MapContainer>
);

export default WfoOpticalLeafletMap;
