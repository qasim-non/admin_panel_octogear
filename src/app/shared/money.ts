import { Language } from '../core/locale.service';

export function sarAmount(value: number, language: Language): string {
    return new Intl.NumberFormat(language, { style: 'currency', currency: 'SAR' }).format(value / 100);
}
