import { orchestratorApi } from '@orchestrator-ui/orchestrator-ui-components';

import { buildOpticalTopology } from '../topology/buildTopology';
import {
  DEFAULT_OPTICAL_PRODUCT_TYPES,
  DEFAULT_OPTICAL_SUBSCRIPTION_STATUSES,
  OpticalTopology,
  RawOpticalSubscription,
} from '../types';

/**
 * The map is built from the generic product block tree of the subscriptions,
 * which orchestrator-core serves for every product. No endpoint of its own is
 * needed in the backend.
 */
export const opticalTopologyQuery = `
query OpticalTopology($first: Int!, $after: Int!, $filterBy: [GraphqlFilter!]) {
    subscriptions(
        first: $first
        after: $after
        filterBy: $filterBy
        sortBy: [{ field: "subscriptionId", order: ASC }]
    ) {
        page {
            subscriptionId
            description
            status
            insync
            product {
                name
                productType
                tag
            }
            customer {
                fullname
            }
            productBlockInstances {
                id
                parent
                subscriptionInstanceId
                ownerSubscriptionId
                productBlockInstanceValues
            }
        }
        pageInfo {
            hasNextPage
            totalItems
        }
    }
}
`;

export type OpticalTopologyVariables = {
  /**
   * Product types to load. Defaults to the product types shipped by
   * `orchestrator-optical`; pass `null` to load every subscription (blocks are
   * recognised by their resource types, so other subscriptions are ignored).
   */
  productTypes?: string[] | null;
  /** Subscription lifecycle states to load. Defaults to active, provisioning and migrating. */
  statuses?: string[];
};

type OpticalTopologyPage = {
  subscriptions: {
    page: RawOpticalSubscription[];
    pageInfo: { hasNextPage: boolean; totalItems: number | null };
  };
};

const PAGE_SIZE = 100;
const MAX_PAGES = 200;

export const getOpticalTopologyFilters = ({ productTypes, statuses }: OpticalTopologyVariables) => {
  const types = productTypes === undefined ? DEFAULT_OPTICAL_PRODUCT_TYPES : productTypes;
  const lifecycles = statuses ?? DEFAULT_OPTICAL_SUBSCRIPTION_STATUSES;
  return [
    ...(lifecycles.length ? [{ field: 'status', value: lifecycles.join('|') }] : []),
    ...(types?.length ? [{ field: 'type', value: types.join('|') }] : []),
  ];
};

const opticalTopologyApi = orchestratorApi.injectEndpoints({
  endpoints: (build) => ({
    getOpticalTopology: build.query<OpticalTopology, OpticalTopologyVariables | void>({
      queryFn: async (variables, _api, _extraOptions, baseQuery) => {
        const filterBy = getOpticalTopologyFilters(variables ?? {});
        const subscriptions: RawOpticalSubscription[] = [];

        for (let page = 0; page < MAX_PAGES; page += 1) {
          const result = await baseQuery({
            document: opticalTopologyQuery,
            variables: { first: PAGE_SIZE, after: subscriptions.length, filterBy },
          });
          if (result.error) {
            return { error: result.error };
          }
          const { subscriptions: response } = result.data as OpticalTopologyPage;
          subscriptions.push(...response.page);
          if (!response.pageInfo.hasNextPage || response.page.length === 0) {
            break;
          }
        }

        return { data: buildOpticalTopology(subscriptions) };
      },
    }),
  }),
});

export const { useGetOpticalTopologyQuery, useLazyGetOpticalTopologyQuery } = opticalTopologyApi;
