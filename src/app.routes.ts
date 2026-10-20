import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './app/core/auth.guard';

export const appRoutes: Routes = [
    { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./app/features/auth/login.component').then(m => m.LoginComponent) },
    { path: '', canActivate: [authGuard], canActivateChild: [authGuard], loadComponent: () => import('./app/layout/component/app.layout').then(m => m.AppLayout), children: [
        { path: '', pathMatch: 'full', redirectTo: 'overview' },
        { path: 'overview', loadComponent: () => import('./app/features/overview/overview.component').then(m => m.OverviewComponent) },
        { path: 'customers', loadComponent: () => import('./app/features/customers/customers.component').then(m => m.CustomersComponent) },
        { path: 'customers/:id', loadComponent: () => import('./app/features/customers/customer-detail.component').then(m => m.CustomerDetailComponent) }
    ] },
    { path: 'access-denied', data: { denied: true }, loadComponent: () => import('./app/features/status/status.component').then(m => m.StatusComponent) },
    { path: '**', loadComponent: () => import('./app/features/status/status.component').then(m => m.StatusComponent) }
];
