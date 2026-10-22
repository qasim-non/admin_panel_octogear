import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export const authGuard: CanActivateFn = (route) => {
    const session = inject(SessionService);
    const router = inject(Router);
    if (session.restoreFailed()) return false;
    if (!session.profile()) return router.createUrlTree(['/login']);
    const permission = route.pathFromRoot.map(item => item.data['permission']).filter(Boolean).at(-1);
    return !permission || session.can(permission) ? true : router.createUrlTree(['/access-denied']);
};
export const guestGuard: CanActivateFn = () => {
    const session = inject(SessionService);
    const router = inject(Router);
    return session.restoreFailed() ? false : session.profile() ? router.createUrlTree([session.home()]) : true;
};
export const homeGuard: CanActivateFn = () => inject(Router).createUrlTree([inject(SessionService).home()]);
