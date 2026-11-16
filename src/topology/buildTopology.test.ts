import { describe, expect, it } from 'vitest';

import { RawOpticalSubscription, RawProductBlockInstance } from '../types';
import { buildOpticalTopology, formatPassband, parsePassband } from './buildTopology';

/** Builds the flat `productBlockInstances` list the GraphQL API returns from a nested description. */
type Tree = { id: string; owner?: string; values: Record<string, unknown>; children?: Tree[] };

const flatten = (root: Tree, subscriptionId: string): RawProductBlockInstance[] => {
  const instances: RawProductBlockInstance[] = [];
  const visit = (tree: Tree, parent: number | null) => {
    const id = instances.length;
    instances.push({
      id,
      parent,
      subscriptionInstanceId: tree.id,
      ownerSubscriptionId: tree.owner ?? subscriptionId,
      productBlockInstanceValues: Object.entries(tree.values).map(([field, value]) => ({
        field,
        value,
      })),
    });
    (tree.children ?? []).forEach((child) => visit(child, id));
  };
  visit(root, null);
  return instances;
};

const subscription = (
  subscriptionId: string,
  root: Tree,
  status = 'ACTIVE',
): RawOpticalSubscription => ({
  subscriptionId,
  description: `description of ${subscriptionId}`,
  status,
  insync: true,
  product: { name: 'product', productType: 'type', tag: 'TAG' },
  customer: { fullname: 'Example customer' },
  productBlockInstances: flatten(root, subscriptionId),
});

const node = (
  name: string,
  role: string,
  latitude: string | null = '45.5',
  longitude: string | null = '9.2',
): Tree => ({
  id: `node-${name}`,
  owner: `sub-node-${name}`,
  values: { name: 'NokiaFlexIlsBlock', opticalNodeRole: role },
  children: [
    {
      id: `mgmt-${name}`,
      owner: `sub-node-${name}`,
      values: {
        opticalModuleNodeName: name,
        opticalModuleNodeVendor: 'Nokia',
        opticalModuleNodePlatform: 'FlexILS',
        opticalModuleNodeManagementIp: '192.0.2.1',
      },
    },
    {
      id: `loc-${name}`,
      owner: 'sub-loc',
      values: { latitude, longitude, locationCode: 'mi01', locationName: 'Milan' },
    },
  ],
});

const port = (id: string, role: string, host: Tree): Tree => ({
  id,
  values: { opticalPortRole: role, opticalPortName: id },
  children: [host],
});

const LINE = 'Optical Line System Line';
const ADD_DROP = 'Optical Line System Add/Drop';
const TRANSPONDER_LINE = 'Transponder Line';
const TRANSPONDER_CLIENT = 'Transponder Client';

const roadmA = node('roadm-a', 'ROADM');
const amplifier = node('amp', 'Amplifier', '44.5', '11.3');
const roadmB = node('roadm-b', 'ROADM', '41.9', '12.5');
const transponderA = node('tp-a', 'Transponder');
const transponderB = node('tp-b', 'Transponder', '41.9', '12.5');

const pipe = (id: string, type: string, a: Tree, b: Tree): Tree => ({
  id,
  values: { opticalPipeType: type, opticalPipeName: `pipe ${id}`, opticalPipeTerminations: [] },
  children: [a, b],
});

const spectrum = (sections: Tree[]): Tree => ({
  id: 'spectrum-1',
  values: {
    opticalSpectrumName: 'polar-crawfish',
    opticalSpectrumPassband: '(194450000, 194550000)',
    opticalSpectrumSections: [],
  },
  children: sections,
});

const section: Tree = {
  id: 'section-1',
  values: { opticalSpectrumSectionAddDropPorts: [], opticalSpectrumSectionExpressPorts: [] },
  children: [
    port('ad-a', ADD_DROP, roadmA),
    port('ad-b', ADD_DROP, roadmB),
    port('line-a', LINE, roadmA),
    port('amp-in', LINE, amplifier),
    port('amp-out', LINE, amplifier),
    port('line-b', LINE, roadmB),
  ],
};

const digitalService = (spectrumBlock: Tree, reverseLinePorts = false): Tree => {
  const linePorts = [
    port('tp-a-line', TRANSPONDER_LINE, transponderA),
    port('tp-b-line', TRANSPONDER_LINE, transponderB),
  ];
  return {
    id: 'service-1',
    values: {
      opticalDigitalServiceName: 'jogger-settling',
      opticalDigitalServiceSpeed: 400,
      opticalDigitalServiceType: 'Ethernet',
    },
    children: [
      port('tp-a-client', TRANSPONDER_CLIENT, transponderA),
      port('tp-b-client', TRANSPONDER_CLIENT, transponderB),
      {
        id: 'channel-1',
        values: {
          opticalTransportChannelName: 'polar-crawfish',
          opticalTransportCentralFrequency: 194500000,
          opticalTransportMode: '600E.96P',
          opticalTransportTotalCapacity: 600,
        },
        children: [...(reverseLinePorts ? linePorts.reverse() : linePorts), spectrumBlock],
      },
    ],
  };
};

describe('buildOpticalTopology', () => {
  it('collects the nodes referenced by other subscriptions once, with role, name and location', () => {
    const topology = buildOpticalTopology([
      subscription('sub-node-roadm-a', roadmA),
      subscription(
        'sub-span',
        pipe('span-1', 'Span', port('p1', LINE, roadmA), port('p2', LINE, amplifier)),
      ),
    ]);

    expect(topology.nodes.map((n) => n.name)).toEqual(['amp', 'roadm-a']);
    const [amp, roadm] = topology.nodes;
    expect(amp).toMatchObject({
      role: 'Amplifier',
      location: { latitude: 44.5, longitude: 11.3, code: 'mi01' },
    });
    expect(roadm).toMatchObject({
      id: 'node-roadm-a',
      vendor: 'Nokia',
      platform: 'FlexILS',
      managementIp: '192.0.2.1',
    });
    // The summary is only known for subscriptions that were loaded themselves.
    expect(roadm.subscription?.description).toBe('description of sub-node-roadm-a');
    expect(amp.subscription).toBeUndefined();
  });

  it('leaves nodes without valid coordinates unplaced', () => {
    const topology = buildOpticalTopology([
      subscription('s1', node('no-coords', 'ROADM', null, null)),
      subscription('s2', node('bad-coords', 'ROADM', '91', '9')),
    ]);
    expect(topology.nodes.map((n) => n.location)).toEqual([null, null]);
  });

  it('builds a pipe per type between the host nodes of its two ports', () => {
    const topology = buildOpticalTopology([
      subscription(
        'sub-span',
        pipe('span-1', 'Span', port('p1', LINE, roadmA), port('p2', LINE, amplifier)),
      ),
      subscription(
        'sub-patch',
        pipe(
          'patch-1',
          'Patch',
          port('p3', TRANSPONDER_LINE, transponderA),
          port('p4', ADD_DROP, roadmA),
        ),
      ),
      subscription(
        'sub-loop',
        pipe(
          'patch-2',
          'Patch',
          port('p5', TRANSPONDER_LINE, transponderA),
          port('p6', TRANSPONDER_CLIENT, transponderA),
        ),
      ),
    ]);

    expect(topology.pipes.map((p) => [p.id, p.pipeType, p.routes])).toEqual([
      ['patch-1', 'Patch', [['node-tp-a', 'node-roadm-a']]],
      // Both ends on the same node: kept, it is drawn as a loop.
      ['patch-2', 'Patch', [['node-tp-a', 'node-tp-a']]],
      ['span-1', 'Span', [['node-roadm-a', 'node-amp']]],
    ]);
    expect(topology.pipes[2].details).toContainEqual({ label: 'A side', value: 'roadm-a p1' });
    expect(topology.pipes[2].subscription?.status).toBe('ACTIVE');
  });

  it('routes a spectrum along its sections: add/drop, express ports, add/drop', () => {
    const topology = buildOpticalTopology([subscription('sub-spectrum', spectrum([section]))]);

    expect(topology.spectrums).toHaveLength(1);
    expect(topology.spectrums[0]).toMatchObject({
      label: 'polar-crawfish',
      sublabel: '194.45 - 194.55 THz (100 GHz)',
      routes: [['node-roadm-a', 'node-amp', 'node-roadm-b']],
    });
  });

  it('routes a spectrum without sections between the line ports of its transport channel', () => {
    const topology = buildOpticalTopology([
      subscription('sub-service', digitalService(spectrum([]))),
    ]);

    expect(topology.spectrums[0].routes).toEqual([['node-tp-a', 'node-tp-b']]);
    expect(topology.digitalServices[0].routes).toEqual([['node-tp-a', 'node-tp-b']]);
  });

  it('routes a digital service from client port to client port through the spectrum', () => {
    const topology = buildOpticalTopology([
      subscription('sub-service', digitalService(spectrum([section]))),
    ]);

    const [service] = topology.digitalServices;
    expect(service).toMatchObject({ label: 'jogger-settling', sublabel: '400G Ethernet' });
    expect(service.routes).toEqual([
      ['node-tp-a', 'node-roadm-a', 'node-amp', 'node-roadm-b', 'node-tp-b'],
    ]);
    expect(service.details).toContainEqual({
      label: 'Channel',
      value: 'polar-crawfish · 194.50 THz · 600E.96P · 600G',
    });
  });

  it('orients the channel and its spectrum towards the first client port, by location', () => {
    const topology = buildOpticalTopology([
      subscription('sub-service', digitalService(spectrum([section]), true)),
    ]);
    expect(topology.digitalServices[0].routes).toEqual([
      ['node-tp-a', 'node-roadm-a', 'node-amp', 'node-roadm-b', 'node-tp-b'],
    ]);
  });

  it('keeps one spectrum when it is reachable through several subscriptions, preferring the routed one', () => {
    const nested = { ...spectrum([section]), owner: 'sub-spectrum' };
    const topology = buildOpticalTopology([
      subscription('sub-service', digitalService(nested)),
      subscription('sub-spectrum', spectrum([section])),
    ]);
    expect(topology.spectrums).toHaveLength(1);
    expect(topology.spectrums[0].subscriptionId).toBe('sub-spectrum');
    expect(topology.spectrums[0].routes).toEqual([['node-roadm-a', 'node-amp', 'node-roadm-b']]);
  });

  it('ignores subscriptions without optical blocks', () => {
    const topology = buildOpticalTopology([
      subscription('sub-customer', { id: 'c', values: { customerName: 'x' } }),
    ]);
    expect(topology).toEqual({ nodes: [], pipes: [], spectrums: [], digitalServices: [] });
  });
});

describe('passband', () => {
  it('parses the tuple representation', () => {
    expect(parsePassband('(194450000, 194550000)')).toEqual([194450000, 194550000]);
    expect(parsePassband([191325000, 196125000])).toEqual([191325000, 196125000]);
    expect(parsePassband('n/a')).toBeNull();
  });

  it('formats in THz with the width in GHz', () => {
    expect(formatPassband('(191325000, 196125000)')).toBe('191.325 - 196.125 THz (4800 GHz)');
  });
});
