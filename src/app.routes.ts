import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './app/core/auth.guard';

export const appRoutes: Routes = [
    { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./app/features/auth/login.component').then(m => m.LoginComponent) },
    { path: '', canActivate: [authGuard], canActivateChild: [authGuard], loadComponent: () => import('./app/layout/component/app.layout').then(m => m.AppLayout), children: [
        { path: '', pathMatch: 'full', redirectTo: 'overview' },
        { path: 'overview', loadComponent: () => import('./app/features/overview/overview.component').then(m => m.OverviewComponent) },
        { path: 'orders', loadComponent: () => import('./app/features/orders/order-directory.component').then(m => m.OrderDirectoryComponent) },
        { path: 'orders/:id', loadComponent: () => import('./app/features/orders/order-detail.component').then(m => m.OrderDetailComponent) },
        { path: 'stores', loadComponent: () => import('./app/features/stores/store-directory.component').then(m => m.StoreDirectoryComponent) },
        { path: 'stores/:id', loadComponent: () => import('./app/features/stores/store-detail.component').then(m => m.StoreDetailComponent) },
        { path: 'store-requests', loadComponent: () => import('./app/features/store-requests/store-requests.component').then(m => m.StoreRequestsComponent) },
        { path: 'store-requests/:id', loadComponent: () => import('./app/features/store-requests/store-request-detail.component').then(m => m.StoreRequestDetailComponent) },
        { path: 'providers', data: { userKind: 'providers' }, loadComponent: () => import('./app/features/users/user-directory.component').then(m => m.UserDirectoryComponent) },
        { path: 'providers/:id', data: { userKind: 'providers' }, loadComponent: () => import('./app/features/users/user-detail.component').then(m => m.UserDetailComponent) },
        { path: 'customers', data: { userKind: 'customers' }, loadComponent: () => import('./app/features/users/user-directory.component').then(m => m.UserDirectoryComponent) },
        { path: 'customers/:id', data: { userKind: 'customers' }, loadComponent: () => import('./app/features/users/user-detail.component').then(m => m.UserDetailComponent) }
    ] },
    { path: 'access-denied', data: { denied: true }, loadComponent: () => import('./app/features/status/status.component').then(m => m.StatusComponent) },
    { path: '**', loadComponent: () => import('./app/features/status/status.component').then(m => m.StatusComponent) }
];
