# orchestrator-optical-ui-library

UI components for the [Workflow Orchestrator](https://workfloworchestrator.org) optical module
([`orchestrator-optical`](https://github.com/workfloworchestrator/orchestrator-optical)). They plug into an orchestrator
UI built with
[`@orchestrator-ui/orchestrator-ui-components`](https://github.com/workfloworchestrator/orchestrator-ui-library).

It currently ships one page, the **optical map**:

- the **optical nodes** on a map, with one shape per `OpticalNodeRole` (ROADM, FOADM, Amplifier, Transponder,
  Transponder and ROADM, Transponder and FOADM, IPoDWDM);
- a selector for what is drawn between them:
  - **Optical pipes** — one stroke per `OpticalPipeType` (Span, Patch, Leased Spectrum);
  - **Optical spectrum** — every `OpticalSpectrumServiceBlock`, routed along its sections;
  - **Digital services** — every `OpticalDigitalServiceBlock`, from client port to client port through its transport
    channels;
- a list of the items of the selected layer, popups with the details and a link to the subscription.

Nodes that share a location are fanned out around it, and lines that share the same two nodes are bent apart, so
nothing is drawn on top of something else.

## How it gets its data

The page needs **no backend change**. It reads the subscriptions through the orchestrator-core GraphQL API
(`subscriptions { productBlockInstances }`) and recognises the optical blocks by their resource types
(`optical_node_role`, `optical_pipe_type`, ...). Products you derive from the `orchestrator-optical` blocks are
therefore picked up too. Requests go through the orchestrator UI's own API store, so authentication works as for
every other page.

Node positions come from the `latitude` / `longitude` of the node's location block. Nodes without valid coordinates
are left off the map and reported above it.

## Install in your orchestrator UI

Your UI is a Next.js app like
[example-orchestrator-ui](https://github.com/workfloworchestrator/example-orchestrator-ui). Three changes are needed.

1. Add the package:

   ```sh
   npm install orchestrator-optical-ui-library
   ```

2. Add it to `transpilePackages` in `next.config.js`. This is required: the library uses the API store of
   `@orchestrator-ui/orchestrator-ui-components`, and both must be bundled by Next.js to share it.

   ```js
   transpilePackages: [
       '@orchestrator-ui/orchestrator-ui-components',
       // ...
       'orchestrator-optical-ui-library',
   ],
   ```

3. Create the page and add it to the menu.

   ```tsx
   // pages/optical-map.tsx
   import React from 'react';

   import { WfoOpticalMapPage } from 'orchestrator-optical-ui-library';

   export default function OpticalMapPage() {
     return <WfoOpticalMapPage />;
   }
   ```

   ```tsx
   // pages/_app.tsx
   import { useRouter } from 'next/router';
   import { getOpticalMapMenuItem } from 'orchestrator-optical-ui-library';

   // inside the app component
   const router = useRouter();
   const addMenuItems = (defaultMenuItems: EuiSideNavItemType<object>[]) => [
       ...defaultMenuItems,
       getOpticalMapMenuItem(router.pathname),
   ];

   <WfoPageTemplate overrideMenuItems={addMenuItems} /* ... */>
   ```

The complete result is in [`example/overlay`](example/overlay).

### Options

`WfoOpticalMapPage` props, all optional:

| prop                   | default                               | meaning                                                                                    |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `defaultLayer`         | `OpticalMapLayer.PIPES`               | layer selected when the page opens                                                         |
| `productTypes`         | the `orchestrator-optical` types      | product types to load; `null` loads every subscription (use it for your own product types) |
| `statuses`             | `active`, `provisioning`, `migrating` | subscription lifecycle states to load                                                      |
| `tileLayerUrl`         | OpenStreetMap                         | map tiles; set your own tile server for production use                                     |
| `tileLayerAttribution` | OpenStreetMap                         | attribution shown for the tiles                                                            |
| `getSubscriptionUrl`   | `/subscriptions/<id>`                 | link target of a subscription                                                              |
| `height`               | `calc(100vh - 260px)`                 | CSS height of the map                                                                      |
| `title`, `labels`      | English                               | texts of the page                                                                          |

`getOpticalMapMenuItem(pathname, { path, label })` takes the path of the page (default `/optical-map`) and the menu
text. The text is looked up in the `main` translations of your UI and used as is when there is no such key.

Lower-level exports, for building your own page: `WfoOpticalMap` (the map for a given topology),
`useGetOpticalTopologyQuery` and `buildOpticalTopology`.

## Try it in example-orchestrator-optical

[`example/Dockerfile`](example/Dockerfile) builds the standard example-orchestrator-ui with this library and the
overlay installed:

```sh
docker build -f example/Dockerfile -t orchestrator-optical-ui:local .
```

`example-orchestrator-optical` uses that image for its `orchestrator-ui` service and can build it itself from a
checkout of this repository next to it (`OPTICAL_UI_LIBRARY_DIR`, default `../orchestrator-optical-ui-library`):

```sh
cd ../example-orchestrator-optical
docker compose build orchestrator-ui
docker compose up -d orchestrator-ui
```

Then open <http://localhost:3000/optical-map>. Rebuild the image after changing the library.

## Development

```sh
npm install
npm test          # unit tests of the topology and layout code
npm run tsc
npm run build     # dist/, also run by `npm pack` and `npm publish`
```

- `src/topology/buildTopology.ts` turns the GraphQL result into nodes, pipes, spectrums and digital services.
- `src/topology/layout.ts` holds the screen geometry (co-located nodes, parallel lines).
- `src/components/WfoOpticalLeafletMap.tsx` is the Leaflet part. It is loaded with a client-only dynamic import
  because Leaflet needs `window`.
- `src/components/leafletCss.generated.ts` is Leaflet's stylesheet, generated by `npm run generate-leaflet-css`. The
  map injects it itself because Next.js refuses global CSS imported from a package.

`OpticalNodeRole` and `OpticalPipeType` in `src/types.ts` mirror the enumerations of `orchestrator-optical`; update
them and the symbols in `src/components/opticalMapSymbols.ts` when the module adds a value. An unknown role is drawn
with a dashed circle and an unknown pipe type with a dotted line, so new values show up rather than disappear.

### Releasing

Bump `version` in `package.json` and publish a GitHub release; the `Publish to npm` workflow publishes the package
(it needs the `NPM_TOKEN` secret). `npm pack` produces the same tarball locally.

## License

Apache-2.0
