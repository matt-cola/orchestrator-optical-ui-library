import React, { FC } from 'react';

import {
  EuiButton,
  EuiCallOut,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiSpacer,
  EuiTitle,
} from '@elastic/eui';

import { OpticalTopologyVariables, useGetOpticalTopologyQuery } from '../rtk/opticalTopology';
import { WfoOpticalMap, WfoOpticalMapProps } from './WfoOpticalMap';

export type WfoOpticalMapPageProps = Omit<WfoOpticalMapProps, 'topology'> &
  OpticalTopologyVariables & {
    title?: string;
    refreshLabel?: string;
    errorTitle?: string;
  };

/**
 * The optical map page: loads the optical subscriptions through the
 * orchestrator GraphQL API and draws them on a map.
 *
 * Use it as the default export of a page of the orchestrator UI, e.g.
 * `pages/optical-map.tsx`.
 */
export const WfoOpticalMapPage: FC<WfoOpticalMapPageProps> = ({
  title = 'Optical map',
  refreshLabel = 'Refresh',
  errorTitle = 'The optical topology could not be loaded',
  productTypes,
  statuses,
  ...mapProps
}) => {
  const { data, isLoading, isFetching, isError, refetch } = useGetOpticalTopologyQuery(
    { productTypes, statuses },
    // The orchestrator API cache is long-lived; a network map should be current when it is opened.
    { refetchOnMountOrArgChange: true },
  );

  return (
    <>
      <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiTitle size="m">
            <h1>{title}</h1>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton size="s" iconType="refresh" onClick={() => refetch()} isLoading={isFetching}>
            {refreshLabel}
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      {isError && (
        <>
          <EuiCallOut color="danger" iconType="error" title={errorTitle} />
          <EuiSpacer size="m" />
        </>
      )}
      {isLoading && <EuiLoadingSpinner size="xl" />}
      {data && <WfoOpticalMap topology={data} {...mapProps} />}
    </>
  );
};
