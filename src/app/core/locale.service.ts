import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

const en = {
    administration: 'Administration', adminPanel: 'Admin panel', welcome: 'Welcome back',
    loginIntro: 'Sign in to your OctoGear admin account.', email: 'Email address', password: 'Password',
    forgot: 'Forgot password?', signIn: 'Sign in', restricted: 'Authorized administrators only',
    language: 'العربية', emailPlaceholder: 'name@octogear.com', emailError: 'Enter a valid email address.',
    passwordError: 'Enter your password (at least 6 characters).', showPassword: 'Show password', hidePassword: 'Hide password',
    recoveryTitle: 'Need access to your account?', recoveryBody: 'Self-service password recovery is not available yet. Contact your OctoGear administrator for help restoring access.',
    understood: 'Got it', connectionError: 'Cannot connect right now. Check your connection and try again.',
    loginError: 'The email or password is incorrect.', blocked: 'This account cannot access the admin panel. Contact your administrator.',
    tooMany: 'Too many attempts. Please wait a minute and try again.', unknownError: 'Something went wrong. Please try again.',
    configTitle: 'Connection settings unavailable', configBody: 'The application could not load its connection settings. Please contact your administrator.',
    reload: 'Reload', overview: 'Overview', workspace: 'Workspace', signOut: 'Sign out', menu: 'Toggle navigation',
    sessionEnded: 'Your session ended. Please sign in again.', expired: 'Session expired',
    overviewIntro: 'A clear view of your OctoGear marketplace.', customers: 'Customers', providers: 'Service providers',
    stores: 'Stores', orders: 'Orders', reviewQueue: 'Awaiting review', pendingStores: 'Store requests',
    pendingIntro: 'Store requests waiting for an administrator’s review.', pending: 'Pending', completed: 'Completed',
    paid: 'Paid', awaitingPayment: 'Awaiting payment', cancelled: 'Cancelled', status: 'Status', total: 'Total',
    orderSummary: 'Order summary', orderSummaryIntro: 'Current order counts by status.', retry: 'Try again',
    liveOverview: 'Marketplace overview', noOrders: 'No orders yet', noOrdersBody: 'Order activity will appear here when customers start placing requests.',
    accessDenied: 'Access denied', accessDeniedBody: 'Your account does not have access to this page.',
    notFound: 'Page not found', notFoundBody: 'This page is unavailable or the address has changed.', back: 'Back to overview',
    signOutFailed: 'Sign-out could not be confirmed. Please try again.', closeMenu: 'Close navigation',
    requestCount: 'Requests awaiting review', refresh: 'Refresh', skip: 'Skip to content',
    customersIntro: 'Find customers, review their details, and manage account access.',
    customerDirectory: 'Customer directory', directoryIntro: 'Your customers, organized in one place.',
    nameSearch: 'Customer name', nameSearchPlaceholder: 'Search by name', phoneSearch: 'Phone number',
    phoneSearchPlaceholder: 'Search by phone number', accountStatus: 'Account status', allStatuses: 'All statuses',
    unblocked: 'Unblocked', blockedStatus: 'Blocked', applyFilters: 'Apply filters', clearFilters: 'Clear filters',
    filterHint: 'Name and phone filters are combined.', customer: 'Customer', city: 'City',
    joinedUtc: 'Joined (UTC)', actions: 'Actions', viewDetails: 'View details', filteredResults: 'Filtered results',
    showing: 'Showing', of: 'of', customersUnit: 'customers', noCustomers: 'No customers yet',
    noCustomersBody: 'Registered customers will appear here.', noMatches: 'No matching customers',
    noMatchesBody: 'Try a different name, phone number, or account status.',
    loadingCustomers: 'Loading customers', customerAccessDenied: 'You do not have permission to manage customers.',
    customerUnavailable: 'Customer unavailable', customerUnavailableBody: 'This customer could not be found or is now a service provider.',
    customerValidationError: 'These filters could not be accepted. Check the name and phone number and try again.',
    customerDetails: 'Customer details', backToCustomers: 'Back to customers', contactDetails: 'Contact details',
    fullName: 'Full name', customerId: 'Customer ID', memberSince: 'Joined date and time (UTC)',
    accountDetails: 'Account details', accountAccess: 'Account access', accountAccessIntro: 'Control this customer’s access to OctoGear.',
    unblockCustomer: 'Unblock customer', blockCustomer: 'Block customer', confirmBlock: 'Block this customer?',
    confirmUnblock: 'Unblock this customer?', blockExplanation: 'This prevents the customer from accessing protected app features. Their account and order history will be kept.',
    unblockExplanation: 'This restores access to protected app features for this customer.',
    cancel: 'Cancel', statusUpdated: 'Account status updated.', statusUncertain: 'The change could not be confirmed. Refresh the customer before trying again.',
    refreshCustomer: 'Refresh customer', notProvided: 'Not provided', customerOrders: 'Orders placed',
    customerOrdersHint: 'Total orders currently counted for this customer.', newestFirst: 'Newest registrations first',
    firstPage: 'First page', previousPage: 'Previous page', nextPage: 'Next page', lastPage: 'Last page', pageNumber: 'Page',
    scrollColumns: 'Scroll sideways to see all columns', loadingDetails: 'Loading customer details', close: 'Close', customerListRegion: 'Customer list; scroll horizontally for more columns'
};
type TextKey = keyof typeof en;
const ar: Record<TextKey, string> = {
    administration: 'الإدارة', adminPanel: 'لوحة الإدارة', welcome: 'أهلاً بعودتك',
    loginIntro: 'سجّل الدخول إلى حساب إدارة أوكتوجير.', email: 'البريد الإلكتروني', password: 'كلمة المرور',
    forgot: 'نسيت كلمة المرور؟', signIn: 'تسجيل الدخول', restricted: 'الدخول للمسؤولين المصرّح لهم فقط',
    language: 'English', emailPlaceholder: 'name@octogear.com', emailError: 'أدخل بريداً إلكترونياً صحيحاً.',
    passwordError: 'أدخل كلمة المرور (6 أحرف على الأقل).', showPassword: 'إظهار كلمة المرور', hidePassword: 'إخفاء كلمة المرور',
    recoveryTitle: 'تحتاج مساعدة للدخول إلى حسابك؟', recoveryBody: 'استعادة كلمة المرور ذاتياً غير متاحة حالياً. تواصل مع مسؤول أوكتوجير للمساعدة في استعادة الوصول إلى حسابك.',
    understood: 'حسناً', connectionError: 'تعذّر الاتصال حالياً. تحقّق من اتصالك وحاول مجدداً.',
    loginError: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.', blocked: 'لا يمكن لهذا الحساب الوصول إلى لوحة الإدارة. تواصل مع المسؤول.',
    tooMany: 'محاولات كثيرة. انتظر دقيقة ثم حاول مجدداً.', unknownError: 'حدث خطأ. يرجى المحاولة مجدداً.',
    configTitle: 'إعدادات الاتصال غير متاحة', configBody: 'تعذّر تحميل إعدادات الاتصال. يرجى التواصل مع المسؤول.',
    reload: 'إعادة التحميل', overview: 'نظرة عامة', workspace: 'مساحة العمل', signOut: 'تسجيل الخروج', menu: 'عرض قائمة التنقل',
    sessionEnded: 'انتهت جلستك. يرجى تسجيل الدخول مجدداً.', expired: 'انتهت الجلسة',
    overviewIntro: 'نظرة واضحة على سوق أوكتوجير.', customers: 'العملاء', providers: 'مقدمو الخدمة',
    stores: 'المتاجر', orders: 'الطلبات', reviewQueue: 'بانتظار المراجعة', pendingStores: 'طلبات المتاجر',
    pendingIntro: 'طلبات المتاجر التي تنتظر مراجعة المسؤول.', pending: 'قيد الانتظار', completed: 'مكتمل',
    paid: 'مدفوع', awaitingPayment: 'بانتظار الدفع', cancelled: 'ملغي', status: 'الحالة', total: 'الإجمالي',
    orderSummary: 'ملخص الطلبات', orderSummaryIntro: 'أعداد الطلبات الحالية حسب الحالة.', retry: 'إعادة المحاولة',
    liveOverview: 'نظرة عامة على السوق', noOrders: 'لا توجد طلبات بعد', noOrdersBody: 'ستظهر حركة الطلبات هنا عندما يبدأ العملاء بإرسال طلباتهم.',
    accessDenied: 'الوصول غير مسموح', accessDeniedBody: 'لا يملك حسابك صلاحية الوصول إلى هذه الصفحة.',
    notFound: 'الصفحة غير موجودة', notFoundBody: 'هذه الصفحة غير متاحة أو تغيّر عنوانها.', back: 'العودة للنظرة العامة',
    signOutFailed: 'تعذّر تأكيد تسجيل الخروج. يرجى المحاولة مجدداً.', closeMenu: 'إغلاق قائمة التنقل',
    requestCount: 'طلبات بانتظار المراجعة', refresh: 'تحديث', skip: 'انتقل إلى المحتوى',
    customersIntro: 'ابحث عن العملاء، وراجع بياناتهم، وأدر الوصول إلى حساباتهم.',
    customerDirectory: 'دليل العملاء', directoryIntro: 'عملاؤك، منظّمون في مكان واحد.',
    nameSearch: 'اسم العميل', nameSearchPlaceholder: 'ابحث بالاسم', phoneSearch: 'رقم الهاتف',
    phoneSearchPlaceholder: 'ابحث برقم الهاتف', accountStatus: 'حالة الحساب', allStatuses: 'جميع الحالات',
    unblocked: 'غير محظور', blockedStatus: 'محظور', applyFilters: 'تطبيق الفلاتر', clearFilters: 'مسح الفلاتر',
    filterHint: 'يتم تطبيق فلتر الاسم ورقم الهاتف معاً.', customer: 'العميل', city: 'المدينة',
    joinedUtc: 'تاريخ الانضمام (UTC)', actions: 'الإجراءات', viewDetails: 'عرض التفاصيل', filteredResults: 'نتائج مفلترة',
    showing: 'عرض', of: 'من', customersUnit: 'عميل', noCustomers: 'لا يوجد عملاء بعد',
    noCustomersBody: 'سيظهر العملاء المسجّلون هنا.', noMatches: 'لا يوجد عملاء مطابقون',
    noMatchesBody: 'جرّب اسماً أو رقم هاتف أو حالة حساب مختلفة.',
    loadingCustomers: 'جارٍ تحميل العملاء', customerAccessDenied: 'ليس لديك إذن لإدارة العملاء.',
    customerUnavailable: 'العميل غير متاح', customerUnavailableBody: 'تعذّر العثور على هذا العميل، أو أصبح مقدم خدمة.',
    customerValidationError: 'تعذّر قبول الفلاتر. تحقّق من الاسم ورقم الهاتف ثم حاول مجدداً.',
    customerDetails: 'تفاصيل العميل', backToCustomers: 'العودة إلى العملاء', contactDetails: 'بيانات التواصل',
    fullName: 'الاسم الكامل', customerId: 'رقم العميل', memberSince: 'تاريخ ووقت الانضمام (UTC)',
    accountDetails: 'بيانات الحساب', accountAccess: 'الوصول إلى الحساب', accountAccessIntro: 'تحكّم في وصول هذا العميل إلى أوكتوجير.',
    unblockCustomer: 'إلغاء حظر العميل', blockCustomer: 'حظر العميل', confirmBlock: 'حظر هذا العميل؟',
    confirmUnblock: 'إلغاء حظر هذا العميل؟', blockExplanation: 'يمنع هذا الإجراء العميل من الوصول إلى ميزات التطبيق المحمية. سيتم الاحتفاظ بحسابه وسجل طلباته.',
    unblockExplanation: 'يستعيد هذا العميل الوصول إلى ميزات التطبيق المحمية.',
    cancel: 'إلغاء', statusUpdated: 'تم تحديث حالة الحساب.', statusUncertain: 'تعذّر تأكيد التغيير. حدّث بيانات العميل قبل المحاولة مجدداً.',
    refreshCustomer: 'تحديث بيانات العميل', notProvided: 'غير متوفر', customerOrders: 'الطلبات المقدّمة',
    customerOrdersHint: 'إجمالي الطلبات المحتسبة حالياً لهذا العميل.', newestFirst: 'الأحدث انضماماً أولاً',
    firstPage: 'الصفحة الأولى', previousPage: 'الصفحة السابقة', nextPage: 'الصفحة التالية', lastPage: 'الصفحة الأخيرة', pageNumber: 'الصفحة',
    scrollColumns: 'مرّر أفقياً لعرض جميع الأعمدة', loadingDetails: 'جارٍ تحميل بيانات العميل', close: 'إغلاق', customerListRegion: 'قائمة العملاء؛ مرّر أفقياً لعرض المزيد من الأعمدة'
};

@Injectable({ providedIn: 'root' })
export class LocaleService {
    private readonly document = inject(DOCUMENT);
    readonly language = signal<'en' | 'ar'>('en');
    constructor() {
        try { this.set(localStorage.getItem('octogear.locale') === 'ar' ? 'ar' : 'en'); } catch { this.set('en'); }
    }
    t(key: TextKey): string { return (this.language() === 'ar' ? ar : en)[key]; }
    toggle(): void { this.set(this.language() === 'en' ? 'ar' : 'en'); }
    private set(language: 'en' | 'ar'): void {
        this.language.set(language);
        this.document.documentElement.lang = language;
        this.document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        try { localStorage.setItem('octogear.locale', language); } catch { /* Preference storage is optional. */ }
    }
}
