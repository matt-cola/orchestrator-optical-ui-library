/**
 * Enumerations mirrored from the `orchestrator-optical` product blocks.
 * Keep the values in sync with:
 *  - products/product_blocks/optical_node/abstracts.py  (OpticalNodeRole)
 *  - products/product_blocks/optical_pipe/abstracts.py  (OpticalPipeType)
 */
export enum OpticalNodeRole {
  ROADM = 'ROADM',
  FOADM = 'FOADM',
  AMPLIFIER = 'Amplifier',
  TRANSPONDER = 'Transponder',
  TRANSPONDER_FOADM = 'Transponder and FOADM',
  TRANSPONDER_ROADM = 'Transponder and ROADM',
  IPODWDM = 'IPoDWDM',
}

export const OPTICAL_NODE_ROLES: OpticalNodeRole[] = [
  OpticalNodeRole.ROADM,
  OpticalNodeRole.FOADM,
  OpticalNodeRole.AMPLIFIER,
  OpticalNodeRole.TRANSPONDER,
  OpticalNodeRole.TRANSPONDER_ROADM,
  OpticalNodeRole.TRANSPONDER_FOADM,
  OpticalNodeRole.IPODWDM,
];

export enum OpticalPipeType {
  SPAN = 'Span',
  PATCH = 'Patch',
  LEASED_SPECTRUM = 'Leased Spectrum',
}

export const OPTICAL_PIPE_TYPES: OpticalPipeType[] = [
  OpticalPipeType.SPAN,
  OpticalPipeType.PATCH,
  OpticalPipeType.LEASED_SPECTRUM,
];

/** The selectable overlays of the optical map. */
export enum OpticalMapLayer {
  PIPES = 'pipes',
  SPECTRUM = 'spectrum',
  DIGITAL_SERVICES = 'digitalServices',
}

/**
 * Product types shipped by `orchestrator-optical` that the map needs
 * (see `orchestrator.optical.products.ProductType`).
 */
export const DEFAULT_OPTICAL_PRODUCT_TYPES: string[] = [
  'OpticalNodeNokiaFlexIlsSubscription',
  'OpticalNodeNokiaGrooveG30Subscription',
  'OpticalNodeNokiaGxG42Subscription',
  'OpticalModulePacketNodeSubscription',
  'OpticalFiberSpanSubscription',
  'OpticalFiberPatchSubscription',
  'OpticalLeasedSpectrumSubscription',
  'OpticalSpectrumServiceSubscription',
  'OpticalDigitalServiceSubscription',
];

export const DEFAULT_OPTICAL_SUBSCRIPTION_STATUSES: string[] = [
  'active',
  'provisioning',
  'migrating',
];

// --- Raw GraphQL shapes -----------------------------------------------------

export type RawFieldValue = {
  field: string;
  value: unknown;
};

export type RawProductBlockInstance = {
  id: number;
  parent: number | null;
  subscriptionInstanceId: string;
  ownerSubscriptionId: string;
  productBlockInstanceValues: RawFieldValue[];
};

export type RawOpticalSubscription = {
  subscriptionId: string;
  description: string;
  status: string;
  insync: boolean;
  product: { name: string; productType: string; tag: string };
  customer?: { fullname: string } | null;
  productBlockInstances: RawProductBlockInstance[];
};

// --- Topology ---------------------------------------------------------------

export type SubscriptionSummary = {
  subscriptionId: string;
  description: string;
  status: string;
  insync: boolean;
  productName: string;
  customer?: string;
};

export type OpticalLocation = {
  code?: string;
  name?: string;
  latitude: number;
  longitude: number;
};

export type OpticalNode = {
  /** subscription_instance_id of the node block */
  id: string;
  name: string;
  role: OpticalNodeRole | string | null;
  vendor?: string;
  platform?: string;
  softwareVersion?: string;
  managementIp?: string;
  /** null when the node has no (valid) coordinates */
  location: OpticalLocation | null;
  subscriptionId: string;
  subscription?: SubscriptionSummary;
};

export type OpticalMapItemKind = 'pipe' | 'spectrum' | 'digitalService';

export type OpticalMapItemDetail = { label: string; value: string };

/** Anything drawn as one or more lines on the map. */
export type OpticalMapItem = {
  /** subscription_instance_id of the block */
  id: string;
  kind: OpticalMapItemKind;
  label: string;
  sublabel?: string;
  pipeType?: OpticalPipeType | string;
  /** Each route is an ordered list of node ids; consecutive nodes are joined by a line. */
  routes: string[][];
  details: OpticalMapItemDetail[];
  subscriptionId: string;
  subscription?: SubscriptionSummary;
};

export type OpticalTopology = {
  nodes: OpticalNode[];
  pipes: OpticalMapItem[];
  spectrums: OpticalMapItem[];
  digitalServices: OpticalMapItem[];
};
