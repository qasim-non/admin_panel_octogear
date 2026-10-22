import { TextKey } from '../../core/i18n/en';

export function roleKey(role: string): TextKey {
    return ({ admin: 'roleAdministrator', manager: 'roleManager', employee: 'roleEmployee', hr: 'roleHr', developer: 'roleDeveloper' } as Record<string, TextKey>)[role] ?? 'adminRole';
}
export function permissionKey(permission: string): TextKey {
    return ({ 'dashboard.view': 'permissionDashboard', 'users.view': 'permissionUsersRead', 'users.manage': 'permissionUsersManage', 'stores.view': 'permissionStoresRead', 'stores.manage': 'permissionStoresManage',
        'requests.view': 'permissionRequestsRead', 'requests.manage': 'permissionRequestsManage', 'orders.view': 'permissionOrdersRead', 'orders.manage': 'permissionOrdersManage', 'payments.view': 'permissionPaymentsRead',
        'payments.manage': 'permissionPaymentsManage', 'support.access': 'permissionSupport', 'catalog.view': 'permissionCatalogRead', 'catalog.manage': 'permissionCatalogManage', 'admins.view': 'permissionAdminsRead', 'admins.manage': 'permissionAdminsManage' } as Record<string, TextKey>)[permission] ?? 'rolePermissions';
}
