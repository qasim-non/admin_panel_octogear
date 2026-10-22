import { Routes } from '@angular/router';
import { authGuard, guestGuard, homeGuard } from './app/core/auth.guard';

export const appRoutes: Routes = [
    { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./app/features/auth/login.component').then(m => m.LoginComponent) },
    { path: '', canActivate: [authGuard], canActivateChild: [authGuard], loadComponent: () => import('./app/layout/component/app.layout').then(m => m.AppLayout), children: [
        { path: '', pathMatch: 'full', canActivate: [homeGuard], children: [] },
        { path: 'chats', data: { permission: 'support.access' }, loadComponent: () => import('./app/features/support/support-workspace.component').then(m => m.SupportWorkspaceComponent), children: [
            { path: '', pathMatch: 'full', loadComponent: () => import('./app/features/support/support-directory.component').then(m => m.SupportDirectoryComponent) },
            { path: ':id', loadComponent: () => import('./app/features/support/support-detail.component').then(m => m.SupportDetailComponent) }
        ] },
        { path: 'sub-admins', data: { permission: 'admins.view' }, loadComponent: () => import('./app/features/admins/admin-directory.component').then(m => m.AdminDirectoryComponent) },
        { path: 'settings', loadComponent: () => import('./app/features/admins/account-settings.component').then(m => m.AccountSettingsComponent) },
        { path: 'overview', data: { permission: 'dashboard.view' }, loadComponent: () => import('./app/features/overview/overview.component').then(m => m.OverviewComponent) },
        { path: 'car-companies', data: { permission: 'catalog.view', catalogKind: 'companies' }, loadComponent: () => import('./app/features/vehicle-catalog/vehicle-catalog.component').then(m => m.VehicleCatalogComponent) },
        { path: 'car-models', data: { permission: 'catalog.view', catalogKind: 'models' }, loadComponent: () => import('./app/features/vehicle-catalog/vehicle-catalog.component').then(m => m.VehicleCatalogComponent) },
        { path: 'orders', data: { permission: 'orders.view' }, loadComponent: () => import('./app/features/orders/order-directory.component').then(m => m.OrderDirectoryComponent) },
        { path: 'payments', data: { permission: 'payments.view' }, loadComponent: () => import('./app/features/payments/payment-directory.component').then(m => m.PaymentDirectoryComponent) },
        { path: 'orders/:id', data: { permission: 'orders.view' }, loadComponent: () => import('./app/features/orders/order-detail.component').then(m => m.OrderDetailComponent) },
        { path: 'stores', data: { permission: 'stores.view' }, loadComponent: () => import('./app/features/stores/store-directory.component').then(m => m.StoreDirectoryComponent) },
        { path: 'stores/:id', data: { permission: 'stores.view' }, loadComponent: () => import('./app/features/stores/store-detail.component').then(m => m.StoreDetailComponent) },
        { path: 'store-requests', data: { permission: 'requests.view' }, loadComponent: () => import('./app/features/store-requests/store-requests.component').then(m => m.StoreRequestsComponent) },
        { path: 'store-requests/:id', data: { permission: 'requests.view' }, loadComponent: () => import('./app/features/store-requests/store-request-detail.component').then(m => m.StoreRequestDetailComponent) },
        { path: 'providers', data: { permission: 'users.view', userKind: 'providers' }, loadComponent: () => import('./app/features/users/user-directory.component').then(m => m.UserDirectoryComponent) },
        { path: 'providers/:id', data: { permission: 'users.view', userKind: 'providers' }, loadComponent: () => import('./app/features/users/user-detail.component').then(m => m.UserDetailComponent) },
        { path: 'customers', data: { permission: 'users.view', userKind: 'customers' }, loadComponent: () => import('./app/features/users/user-directory.component').then(m => m.UserDirectoryComponent) },
        { path: 'customers/:id', data: { permission: 'users.view', userKind: 'customers' }, loadComponent: () => import('./app/features/users/user-detail.component').then(m => m.UserDetailComponent) }
    ] },
    { path: 'access-denied', data: { denied: true }, loadComponent: () => import('./app/features/status/status.component').then(m => m.StatusComponent) },
    { path: '**', loadComponent: () => import('./app/features/status/status.component').then(m => m.StatusComponent) }
];
