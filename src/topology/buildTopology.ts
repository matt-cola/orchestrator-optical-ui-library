import {
  OpticalLocation,
  OpticalMapItem,
  OpticalMapItemDetail,
  OpticalNode,
  OpticalTopology,
  RawOpticalSubscription,
  SubscriptionSummary,
} from '../types';

/**
 * Builds the optical topology from the generic `productBlockInstances` tree
 * that orchestrator-core exposes for every subscription.
 *
 * Blocks are recognised by the resource types they carry (`opticalNodeRole`,
 * `opticalPipeType`, ...) rather than by product or block name, so products
 * that a deployment derives from the `orchestrator-optical` blocks are picked
 * up as well.
 */

type Block = {
  instanceId: string;
  ownerSubscriptionId: string;
  values: Record<string, unknown>;
  children: Block[];
};

const has = (block: Block, field: string) => field in block.values;

const isNode = (block: Block) => has(block, 'opticalNodeRole');
const isPort = (block: Block) => has(block, 'opticalPortRole');
const isPipe = (block: Block) => has(block, 'opticalPipeType');
const isSpectrum = (block: Block) => has(block, 'opticalSpectrumPassband');
const isSpectrumSection = (block: Block) => has(block, 'opticalSpectrumSectionAddDropPorts');
const isTransportChannel = (block: Block) => has(block, 'opticalTransportChannelName');
const isDigitalService = (block: Block) => has(block, 'opticalDigitalServiceName');
const isLocation = (block: Block) => has(block, 'latitude') && has(block, 'longitude');
const isManagement = (block: Block) => has(block, 'opticalModuleNodeName');

const OLS_ADD_DROP_ROLE = 'Optical Line System Add/Drop';

const text = (value: unknown): string | undefined =>
  value === null || value === undefined || value === '' ? undefined : String(value);

const toBlocks = (subscription: RawOpticalSubscription): Block[] => {
  const byId = new Map<number, Block>();
  for (const instance of subscription.productBlockInstances ?? []) {
    const values: Record<string, unknown> = {};
    for (const { field, value } of instance.productBlockInstanceValues ?? []) {
      values[field] = value;
    }
    byId.set(instance.id, {
      instanceId: instance.subscriptionInstanceId,
      ownerSubscriptionId: instance.ownerSubscriptionId,
      values,
      children: [],
    });
  }
  const roots: Block[] = [];
  for (const instance of subscription.productBlockInstances ?? []) {
    const block = byId.get(instance.id)!;
    const parent = instance.parent === null ? undefined : byId.get(instance.parent);
    if (parent) {
      parent.children.push(block);
    } else {
      roots.push(block);
    }
  }
  return roots;
};

const walk = (block: Block, visit: (block: Block, parent?: Block) => void, parent?: Block) => {
  visit(block, parent);
  for (const child of block.children) {
    walk(child, visit, block);
  }
};

const parseCoordinate = (value: unknown, limit: number): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
};

const parseLocation = (block: Block | undefined): OpticalLocation | null => {
  if (!block) return null;
  const latitude = parseCoordinate(block.values.latitude, 90);
  const longitude = parseCoordinate(block.values.longitude, 180);
  if (latitude === null || longitude === null) return null;
  return {
    latitude,
    longitude,
    code: text(block.values.locationCode),
    name: text(block.values.locationName),
  };
};

const parseNode = (block: Block): OpticalNode => {
  const management = block.children.find(isManagement);
  return {
    id: block.instanceId,
    name: text(management?.values.opticalModuleNodeName) ?? block.instanceId,
    role: text(block.values.opticalNodeRole) ?? null,
    vendor: text(management?.values.opticalModuleNodeVendor),
    platform: text(management?.values.opticalModuleNodePlatform),
    softwareVersion: text(management?.values.opticalModuleNodeSoftwareVersion),
    managementIp:
      text(management?.values.opticalModuleNodeManagementIp) ??
      text(management?.values.opticalModuleNodeManagementLoopbackIp),
    location: parseLocation(block.children.find(isLocation)),
    subscriptionId: block.ownerSubscriptionId,
  };
};

type PortEnd = { nodeId?: string; nodeName?: string; portName?: string; role?: string };

const parsePort = (block: Block): PortEnd => {
  const node = block.children.find(isNode);
  const management = node?.children.find(isManagement);
  return {
    nodeId: node?.instanceId,
    nodeName: text(management?.values.opticalModuleNodeName),
    portName: text(block.values.opticalPortName),
    role: text(block.values.opticalPortRole),
  };
};

const describeEnd = (end: PortEnd | undefined): string =>
  end ? [end.nodeName, end.portName].filter(Boolean).join(' ') || '-' : '-';

/** Drops undefined entries and consecutive duplicates. */
const compactRoute = (nodeIds: (string | undefined)[]): string[] => {
  const route: string[] = [];
  for (const nodeId of nodeIds) {
    if (nodeId && route[route.length - 1] !== nodeId) {
      route.push(nodeId);
    }
  }
  return route;
};

/** "(194450000, 194550000)" (MHz) -> [194450000, 194550000] */
export const parsePassband = (value: unknown): [number, number] | null => {
  const numbers = Array.isArray(value)
    ? value.map(Number)
    : (String(value ?? '').match(/\d+(\.\d+)?/g) ?? []).map(Number);
  if (numbers.length !== 2 || numbers.some((n) => !Number.isFinite(n))) return null;
  return [numbers[0], numbers[1]];
};

const mhzToThz = (mhz: number): string => (mhz / 1_000_000).toFixed(4).replace(/0{1,2}$/, '');

export const formatPassband = (value: unknown): string | undefined => {
  const passband = parsePassband(value);
  if (!passband) return text(value);
  const [low, high] = passband;
  return `${mhzToThz(low)} - ${mhzToThz(high)} THz (${Math.round((high - low) / 1000)} GHz)`;
};

export const formatFrequency = (mhz: unknown): string | undefined => {
  const parsed = Number(mhz);
  return mhz === null || mhz === undefined || !Number.isFinite(parsed)
    ? undefined
    : `${mhzToThz(parsed)} THz`;
};

const detail = (label: string, value: string | undefined): OpticalMapItemDetail[] =>
  value === undefined ? [] : [{ label, value }];

/** Node route of a spectrum: add/drop -> express ports -> add/drop, section after section. */
const spectrumSectionRoute = (spectrum: Block): string[] =>
  compactRoute(
    spectrum.children.filter(isSpectrumSection).flatMap((section) => {
      const ports = section.children.filter(isPort).map(parsePort);
      const addDrop = ports.filter((port) => port.role === OLS_ADD_DROP_ROLE);
      const express = ports.filter((port) => port.role !== OLS_ADD_DROP_ROLE);
      return [addDrop[0], ...express, ...addDrop.slice(1)].map((port) => port?.nodeId);
    }),
  );

const transportChannelLineEnds = (channel: Block): PortEnd[] =>
  channel.children.filter(isPort).map(parsePort);

/** Looks up where a node is, to tell which end of a route is next to another node. */
type Locate = (nodeId: string) => OpticalLocation | null | undefined;

const squaredDistance = (a: OpticalLocation, b: OpticalLocation): number =>
  (a.latitude - b.latitude) ** 2 + (a.longitude - b.longitude) ** 2;

/**
 * Returns the route starting at the end that belongs to `anchor`: the end that
 * is the anchor node itself or, failing that, the end closest to it. Blocks
 * list their ports in no guaranteed common direction (e.g. the line ports of a
 * transport channel versus the sections of its spectrum).
 */
export const orientRoute = (
  route: string[],
  anchor: string | undefined,
  locate: Locate,
): string[] => {
  if (route.length < 2 || !anchor) return route;
  const first = route[0];
  const last = route[route.length - 1];
  if (first === anchor) return route;
  if (last === anchor) return [...route].reverse();
  const [at, start, end] = [locate(anchor), locate(first), locate(last)];
  if (at && start && end && squaredDistance(at, end) < squaredDistance(at, start)) {
    return [...route].reverse();
  }
  return route;
};

/** Route of a transport channel: line port -> spectrum path -> line port. */
const transportChannelRoute = (channel: Block, locate: Locate): string[] => {
  const lineEnds = transportChannelLineEnds(channel);
  const spectrum = channel.children.find(isSpectrum);
  const first = lineEnds[0]?.nodeId;
  const last = lineEnds[lineEnds.length - 1]?.nodeId;
  const spectrumRoute = orientRoute(spectrum ? spectrumSectionRoute(spectrum) : [], first, locate);
  return compactRoute([first, ...spectrumRoute, last]);
};

const parsePipe = (block: Block): OpticalMapItem => {
  const ends = block.children.filter(isPort).map(parsePort);
  const pipeType = text(block.values.opticalPipeType);
  const label =
    text(block.values.opticalPipeName) ?? `${describeEnd(ends[0])} --- ${describeEnd(ends[1])}`;
  // Not compacted: a pipe may connect two ports of the same node (drawn as a loop).
  const route = ends.map((end) => end.nodeId).filter((nodeId): nodeId is string => !!nodeId);
  return {
    id: block.instanceId,
    kind: 'pipe',
    label,
    sublabel: pipeType,
    pipeType,
    routes: route.length === 2 ? [route] : [],
    details: [
      ...detail('Type', pipeType),
      ...detail('A side', describeEnd(ends[0])),
      ...detail('B side', describeEnd(ends[1])),
    ],
    subscriptionId: block.ownerSubscriptionId,
  };
};

const parseSpectrum = (block: Block, parent: Block | undefined, locate: Locate): OpticalMapItem => {
  let route = spectrumSectionRoute(block);
  let ends: PortEnd[] = [];
  if (parent && isTransportChannel(parent)) {
    ends = transportChannelLineEnds(parent);
    if (route.length < 2) {
      // No line system in between (e.g. back-to-back transponders): the spectrum runs between the line ports.
      route = transportChannelRoute(parent, locate);
    }
  }
  const passband = formatPassband(block.values.opticalSpectrumPassband);
  const sections = block.children.filter(isSpectrumSection).length;
  return {
    id: block.instanceId,
    kind: 'spectrum',
    label: text(block.values.opticalSpectrumName) ?? block.instanceId,
    sublabel: passband,
    routes: route.length > 1 ? [route] : [],
    details: [
      ...detail('Passband', passband),
      ...detail('Sections', String(sections)),
      ...(parent && isTransportChannel(parent)
        ? [
            ...detail('Transport channel', text(parent.values.opticalTransportChannelName)),
            ...detail('Line ports', ends.length ? ends.map(describeEnd).join(' <-> ') : undefined),
          ]
        : []),
    ],
    subscriptionId: block.ownerSubscriptionId,
  };
};

const parseDigitalService = (block: Block, locate: Locate): OpticalMapItem => {
  const clientEnds = block.children.filter(isPort).map(parsePort);
  const channels = block.children.filter(isTransportChannel);
  const firstClient = clientEnds[0]?.nodeId;
  const lastClient = clientEnds[clientEnds.length - 1]?.nodeId;

  const routes = channels
    .map((channel) =>
      compactRoute([
        firstClient,
        ...orientRoute(transportChannelRoute(channel, locate), firstClient, locate),
        lastClient,
      ]),
    )
    .filter((route) => route.length > 1);
  if (routes.length === 0) {
    const direct = compactRoute([firstClient, lastClient]);
    if (direct.length > 1) routes.push(direct);
  }

  const speed = text(block.values.opticalDigitalServiceSpeed);
  const type = text(block.values.opticalDigitalServiceType);
  const sublabel = [speed ? `${speed}G` : undefined, type].filter(Boolean).join(' ') || undefined;

  return {
    id: block.instanceId,
    kind: 'digitalService',
    label: text(block.values.opticalDigitalServiceName) ?? block.instanceId,
    sublabel,
    routes,
    details: [
      ...detail('Service', sublabel),
      ...detail(
        'Client ports',
        clientEnds.length ? clientEnds.map(describeEnd).join(' <-> ') : undefined,
      ),
      ...channels.flatMap((channel, index) => {
        const prefix = channels.length > 1 ? `Channel ${index + 1}` : 'Channel';
        const capacity = text(channel.values.opticalTransportTotalCapacity);
        return [
          ...detail(
            prefix,
            [
              text(channel.values.opticalTransportChannelName),
              formatFrequency(channel.values.opticalTransportCentralFrequency),
              text(channel.values.opticalTransportMode),
              capacity ? `${capacity}G` : undefined,
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
          ),
          ...detail(
            `${prefix} line ports`,
            transportChannelLineEnds(channel).map(describeEnd).join(' <-> ') || undefined,
          ),
        ];
      }),
    ],
    subscriptionId: block.ownerSubscriptionId,
  };
};

const routeLength = (item: OpticalMapItem) =>
  item.routes.reduce((total, route) => total + route.length, 0);

const byLabel = <T extends { label?: string; name?: string }>(a: T, b: T) =>
  (a.label ?? a.name ?? '').localeCompare(b.label ?? b.name ?? '', undefined, { numeric: true });

export const buildOpticalTopology = (subscriptions: RawOpticalSubscription[]): OpticalTopology => {
  const summaries = new Map<string, SubscriptionSummary>();
  const nodes = new Map<string, OpticalNode>();
  const pipes = new Map<string, OpticalMapItem>();
  const spectrums = new Map<string, OpticalMapItem>();
  const digitalServices = new Map<string, OpticalMapItem>();

  /** The same block is reachable through several subscriptions: keep the most complete rendition. */
  const keepBest = (target: Map<string, OpticalMapItem>, item: OpticalMapItem) => {
    const existing = target.get(item.id);
    if (!existing || routeLength(item) > routeLength(existing)) {
      target.set(
        item.id,
        existing
          ? { ...item, details: item.details.length ? item.details : existing.details }
          : item,
      );
    }
  };

  const trees = subscriptions.map(toBlocks);

  // Nodes first: routing the services needs to know where the nodes are.
  subscriptions.forEach((subscription, index) => {
    summaries.set(subscription.subscriptionId, {
      subscriptionId: subscription.subscriptionId,
      description: subscription.description,
      status: subscription.status,
      insync: subscription.insync,
      productName: subscription.product?.name,
      customer: subscription.customer?.fullname ?? undefined,
    });
    for (const root of trees[index]) {
      walk(root, (block) => {
        if (!isNode(block)) return;
        const node = parseNode(block);
        const existing = nodes.get(node.id);
        if (!existing || (!existing.location && node.location)) nodes.set(node.id, node);
      });
    }
  });

  const locate: Locate = (nodeId) => nodes.get(nodeId)?.location;

  for (const roots of trees) {
    for (const root of roots) {
      walk(root, (block, parent) => {
        if (isPipe(block)) {
          keepBest(pipes, parsePipe(block));
        } else if (isSpectrum(block)) {
          keepBest(spectrums, parseSpectrum(block, parent, locate));
        } else if (isDigitalService(block)) {
          keepBest(digitalServices, parseDigitalService(block, locate));
        }
      });
    }
  }

  const withSubscription = <T extends { subscriptionId: string }>(entry: T): T => ({
    ...entry,
    subscription: summaries.get(entry.subscriptionId),
  });

  return {
    nodes: [...nodes.values()].map(withSubscription).sort(byLabel),
    pipes: [...pipes.values()].map(withSubscription).sort(byLabel),
    spectrums: [...spectrums.values()].map(withSubscription).sort(byLabel),
    digitalServices: [...digitalServices.values()].map(withSubscription).sort(byLabel),
  };
};
