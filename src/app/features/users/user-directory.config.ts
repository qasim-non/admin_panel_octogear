import { TextKey } from '../../core/locale.service';

export type UserKind = 'customers' | 'providers';
export interface UserDirectoryConfig {
    kind: UserKind;
    type: 'customer' | 'service provider';
    path: string;
    icon: string;
    copy: Record<'title' | 'intro' | 'directory' | 'directoryIntro' | 'unit' | 'nameLabel' | 'person' | 'loading' | 'empty' | 'emptyBody' | 'noMatches' | 'listRegion' | 'back' | 'details' | 'loadingDetails' | 'unavailable' | 'unavailableBody' | 'idLabel' | 'accessIntro' | 'refresh' | 'unblock' | 'block' | 'confirmUnblock' | 'confirmBlock' | 'unblockExplanation' | 'blockExplanation' | 'metric' | 'metricHint' | 'denied' | 'uncertain', TextKey>;
}

// Both account types use the same Laravel user contract and UI behavior.
export const USER_DIRECTORIES: Record<UserKind, UserDirectoryConfig> = {
    customers: {
        kind: 'customers', type: 'customer', path: '/customers', icon: 'pi pi-users',
        copy: {
            title: 'customers',
            intro: 'customersIntro',
            directory: 'customerDirectory',
            directoryIntro: 'directoryIntro',
            unit: 'customersUnit',
            nameLabel: 'nameSearch',
            person: 'customer',
            loading: 'loadingCustomers',
            empty: 'noCustomers',
            emptyBody: 'noCustomersBody',
            noMatches: 'noMatches',
            listRegion: 'customerListRegion',
            back: 'backToCustomers',
            details: 'customerDetails',
            loadingDetails: 'loadingDetails',
            unavailable: 'customerUnavailable',
            unavailableBody: 'customerUnavailableBody',
            idLabel: 'customerId',
            accessIntro: 'accountAccessIntro',
            refresh: 'refreshCustomer',
            unblock: 'unblockCustomer',
            block: 'blockCustomer',
            confirmUnblock: 'confirmUnblock',
            confirmBlock: 'confirmBlock',
            unblockExplanation: 'unblockExplanation',
            blockExplanation: 'blockExplanation',
            metric: 'customerOrders',
            metricHint: 'customerOrdersHint',
            denied: 'customerAccessDenied',
            uncertain: 'statusUncertain'
        }
    },
    providers: {
        kind: 'providers', type: 'service provider', path: '/providers', icon: 'pi pi-briefcase',
        copy: {
            title: 'providers',
            intro: 'providersIntro',
            directory: 'providerDirectory',
            directoryIntro: 'providerDirectoryIntro',
            unit: 'providersUnit',
            nameLabel: 'providerName',
            person: 'provider',
            loading: 'loadingProviders',
            empty: 'noProviders',
            emptyBody: 'noProvidersBody',
            noMatches: 'noMatchingProviders',
            listRegion: 'providerListRegion',
            back: 'backToProviders',
            details: 'providerDetails',
            loadingDetails: 'loadingProviderDetails',
            unavailable: 'providerUnavailable',
            unavailableBody: 'providerUnavailableBody',
            idLabel: 'providerId',
            accessIntro: 'providerAccessIntro',
            refresh: 'refreshProvider',
            unblock: 'unblockProvider',
            block: 'blockProvider',
            confirmUnblock: 'confirmUnblockProvider',
            confirmBlock: 'confirmBlockProvider',
            unblockExplanation: 'unblockProviderExplanation',
            blockExplanation: 'blockProviderExplanation',
            metric: 'providerStores',
            metricHint: 'providerStoresHint',
            denied: 'providerAccessDenied',
            uncertain: 'providerStatusUncertain'
        }
    }
};
