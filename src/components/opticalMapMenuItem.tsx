import React from 'react';

import type { EuiSideNavItemType } from '@elastic/eui';
import { WfoMenuItemLink } from '@orchestrator-ui/orchestrator-ui-components';

export const PATH_OPTICAL_MAP = '/optical-map';

export type OpticalMapMenuItemOptions = {
  /** Path of the page that renders `WfoOpticalMapPage`. */
  path?: string;
  /**
   * Text of the menu item. It is looked up in the `main` translations of the
   * orchestrator UI first and used as is when there is no such key.
   */
  label?: string;
};

/**
 * Side menu entry of the optical map, for the `overrideMenuItems` prop of
 * `WfoPageTemplate`:
 *
 *   overrideMenuItems={(items) => [...items, getOpticalMapMenuItem(router.pathname)]}
 */
export const getOpticalMapMenuItem = (
  currentPathname: string,
  { path = PATH_OPTICAL_MAP, label = 'Optical map' }: OpticalMapMenuItemOptions = {},
): EuiSideNavItemType<object> => {
  const isSelected = currentPathname === path;
  return {
    name: label,
    id: 'optical-map',
    isSelected,
    href: path,
    renderItem: () => (
      <WfoMenuItemLink path={path} translationString={label} isSelected={isSelected} />
    ),
  };
};
