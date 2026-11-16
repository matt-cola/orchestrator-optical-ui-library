import React, { FC } from 'react';

import { LEAFLET_CSS } from './leafletCss.generated';

/**
 * Stylesheet of the optical map: Leaflet's own CSS plus the map chrome.
 * Colours come from CSS variables that `WfoOpticalMap` sets from the EUI theme.
 */
const OPTICAL_MAP_CSS = `
.wfo-optical-map {
  display: flex;
  gap: 16px;
  align-items: stretch;
  color: var(--wom-text);
}
.wfo-optical-map__main {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}
.wfo-optical-map__leaflet {
  height: 100%;
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--wom-border);
  background: var(--wom-bg-subdued);
  font: inherit;
  z-index: 0;
}
.wfo-optical-map--dark .leaflet-tile-pane,
.wfo-optical-map--dark .leaflet-control-zoom,
.wfo-optical-map--dark .leaflet-control-attribution {
  filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
}
.wfo-optical-map__node {
  background: none;
  border: none;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
}
.wfo-optical-map__node svg {
  display: block;
}
.wfo-optical-map__site-label span {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  background: var(--wom-bg);
  color: var(--wom-subdued);
  border: 1px solid var(--wom-border);
}
.wfo-optical-map .leaflet-tooltip {
  background: var(--wom-bg);
  color: var(--wom-text);
  border: 1px solid var(--wom-border);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  font-size: 12px;
  padding: 2px 6px;
}
.wfo-optical-map .leaflet-tooltip::before {
  display: none;
}
.wfo-optical-map .leaflet-popup-content-wrapper,
.wfo-optical-map .leaflet-popup-tip {
  background: var(--wom-bg);
  color: var(--wom-text);
}
.wfo-optical-map .leaflet-popup-content {
  margin: 12px 14px;
  min-width: 220px;
}
.wfo-optical-map .leaflet-container a.leaflet-popup-close-button {
  color: var(--wom-subdued);
}
.wfo-optical-map__popup {
  font-size: 13px;
  line-height: 1.45;
}
.wfo-optical-map__popup-title {
  font-weight: 700;
  font-size: 14px;
  padding-right: 16px;
  overflow-wrap: anywhere;
}
.wfo-optical-map__popup-subtitle {
  color: var(--wom-subdued);
  overflow-wrap: anywhere;
}
.wfo-optical-map__popup dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 12px;
  margin: 8px 0;
}
.wfo-optical-map__popup dt {
  color: var(--wom-subdued);
}
.wfo-optical-map__popup dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.wfo-optical-map .leaflet-container .wfo-optical-map__popup a {
  color: var(--wom-primary);
  font-weight: 600;
}
.wfo-optical-map__badges {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
.wfo-optical-map__badge {
  display: inline-block;
  padding: 0 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  border: 1px solid var(--wom-border);
  color: var(--wom-subdued);
}
.wfo-optical-map__badge--success {
  border-color: var(--wom-success);
  color: var(--wom-success);
}
.wfo-optical-map__badge--warning {
  border-color: var(--wom-warning);
  color: var(--wom-warning);
}
.wfo-optical-map__badge--danger {
  border-color: var(--wom-danger);
  color: var(--wom-danger);
}
.wfo-optical-map__legend {
  position: absolute;
  left: 10px;
  bottom: 10px;
  z-index: 500;
  max-width: 260px;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid var(--wom-border);
  background: var(--wom-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 12px;
}
.wfo-optical-map__legend h4 {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--wom-subdued);
}
.wfo-optical-map__legend h4:not(:first-child) {
  margin-top: 10px;
}
.wfo-optical-map__legend ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.wfo-optical-map__legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 22px;
}
.wfo-optical-map__legend li > span:first-child {
  display: inline-flex;
  justify-content: center;
  width: 34px;
  flex: 0 0 34px;
}
.wfo-optical-map__panel {
  flex: 0 0 320px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--wom-border);
  border-radius: 6px;
  background: var(--wom-bg);
}
.wfo-optical-map__panel-header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--wom-border);
  font-weight: 700;
  font-size: 13px;
}
.wfo-optical-map__panel-header small {
  font-weight: 400;
  color: var(--wom-subdued);
  margin-left: 6px;
}
.wfo-optical-map__list {
  list-style: none;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  flex: 1 1 auto;
}
.wfo-optical-map__list-empty {
  padding: 16px 12px;
  color: var(--wom-subdued);
  font-size: 13px;
}
.wfo-optical-map__list button {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.wfo-optical-map__list button:hover {
  background: var(--wom-bg-subdued);
}
.wfo-optical-map__list button:focus-visible {
  outline: 2px solid var(--wom-primary);
  outline-offset: -2px;
}
.wfo-optical-map__list button[aria-pressed='true'] {
  border-color: var(--wom-primary);
  background: var(--wom-bg-subdued);
}
.wfo-optical-map__list-swatch {
  flex: 0 0 34px;
  padding-top: 3px;
}
.wfo-optical-map__list-text {
  min-width: 0;
  flex: 1 1 auto;
}
.wfo-optical-map__list-label {
  display: block;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.wfo-optical-map__list-sublabel {
  display: block;
  color: var(--wom-subdued);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.wfo-optical-map__list-note {
  display: block;
  color: var(--wom-warning);
  font-size: 12px;
}
@media (max-width: 900px) {
  .wfo-optical-map {
    flex-direction: column;
  }
  .wfo-optical-map__main {
    flex: 0 0 60vh;
  }
  .wfo-optical-map__panel {
    flex: 0 0 auto;
    max-height: 40vh;
  }
}
`;

export const OpticalMapStyles: FC = () => <style>{`${LEAFLET_CSS}\n${OPTICAL_MAP_CSS}`}</style>;
