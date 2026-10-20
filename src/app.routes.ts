import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './app/core/auth.guard';

export const appRoutes: Routes = [
    { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./app/features/auth/login.component').then(m => m.LoginComponent) },
    { path: '', canActivate: [authGuard], canActivateChild: [authGuard], loadComponent: () => import('./app/layout/component/app.layout').then(m => m.AppLayout), children: [
        { path: '', pathMatch: 'full', redirectTo: 'overview' },
        { path: 'overview', loadComponent: () => import('./app/features/overview/overview.component').then(m => m.OverviewComponent) },
        { path: 'providers', data: { userKind: 'providers' }, loadComponent: () => import('./app/features/users/user-directory.component').then(m => m.UserDirectoryComponent) },
        { path: 'providers/:id', data: { userKind: 'providers' }, loadComponent: () => import('./app/features/users/user-detail.component').then(m => m.UserDetailComponent) },
        { path: 'customers', data: { userKind: 'customers' }, loadComponent: () => import('./app/features/users/user-directory.component').then(m => m.UserDirectoryComponent) },
        { path: 'customers/:id', data: { userKind: 'customers' }, loadComponent: () => import('./app/features/users/user-detail.component').then(m => m.UserDetailComponent) }
    ] },
    { path: 'access-denied', data: { denied: true }, loadComponent: () => import('./app/features/status/status.component').then(m => m.StatusComponent) },
    { path: '**', loadComponent: () => import('./app/features/status/status.component').then(m => m.StatusComponent) }
];
