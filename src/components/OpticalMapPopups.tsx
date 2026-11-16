import React, { FC } from 'react';

import Link from 'next/link';

import { OpticalMapItem, OpticalMapItemDetail, OpticalNode, SubscriptionSummary } from '../types';

const STATUS_MODIFIER: Record<string, string> = {
  ACTIVE: 'success',
  PROVISIONING: 'warning',
  MIGRATING: 'warning',
};

export const OpticalMapStatus: FC<{ subscription?: SubscriptionSummary }> = ({ subscription }) => {
  if (!subscription) return null;
  const status = subscription.status?.toUpperCase() ?? '';
  return (
    <span className="wfo-optical-map__badges">
      <span
        className={`wfo-optical-map__badge wfo-optical-map__badge--${STATUS_MODIFIER[status] ?? 'neutral'}`}
      >
        {status.toLowerCase()}
      </span>
      {!subscription.insync && (
        <span className="wfo-optical-map__badge wfo-optical-map__badge--danger">out of sync</span>
      )}
    </span>
  );
};

type PopupProps = {
  title: string;
  subtitle?: string;
  details: OpticalMapItemDetail[];
  subscriptionId: string;
  subscription?: SubscriptionSummary;
  getSubscriptionUrl: (subscriptionId: string) => string;
};

const OpticalMapPopup: FC<PopupProps> = ({
  title,
  subtitle,
  details,
  subscriptionId,
  subscription,
  getSubscriptionUrl,
}) => (
  <div className="wfo-optical-map__popup">
    <div className="wfo-optical-map__popup-title">{title}</div>
    {subtitle && <div className="wfo-optical-map__popup-subtitle">{subtitle}</div>}
    <OpticalMapStatus subscription={subscription} />
    <dl>
      {details.map(({ label, value }) => (
        <React.Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </React.Fragment>
      ))}
      {subscription?.customer && (
        <>
          <dt>Customer</dt>
          <dd>{subscription.customer}</dd>
        </>
      )}
    </dl>
    {subscriptionId && <Link href={getSubscriptionUrl(subscriptionId)}>Open subscription</Link>}
  </div>
);

const detail = (label: string, value: string | undefined | null): OpticalMapItemDetail[] =>
  value ? [{ label, value }] : [];

export const OpticalMapNodePopup: FC<{
  node: OpticalNode;
  getSubscriptionUrl: (subscriptionId: string) => string;
}> = ({ node, getSubscriptionUrl }) => (
  <OpticalMapPopup
    title={node.name}
    subtitle={node.role ?? 'Unknown role'}
    details={[
      ...detail('Platform', [node.vendor, node.platform].filter(Boolean).join(' ')),
      ...detail('Software', node.softwareVersion),
      ...detail('Management IP', node.managementIp),
      ...detail('Location', [node.location?.name, node.location?.code].filter(Boolean).join(' · ')),
      ...detail(
        'Coordinates',
        node.location ? `${node.location.latitude}, ${node.location.longitude}` : undefined,
      ),
    ]}
    subscriptionId={node.subscriptionId}
    subscription={node.subscription}
    getSubscriptionUrl={getSubscriptionUrl}
  />
);

export const OpticalMapItemPopup: FC<{
  item: OpticalMapItem;
  getSubscriptionUrl: (subscriptionId: string) => string;
}> = ({ item, getSubscriptionUrl }) => (
  <OpticalMapPopup
    title={item.label}
    subtitle={
      item.subscription?.description !== item.label ? item.subscription?.description : undefined
    }
    details={item.details}
    subscriptionId={item.subscriptionId}
    subscription={item.subscription}
    getSubscriptionUrl={getSubscriptionUrl}
  />
);
