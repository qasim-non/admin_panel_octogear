import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const OctoGearPreset = definePreset(Aura, {
    semantic: {
        primary: { 50: '#f1f3f7', 100: '#e2e6ef', 200: '#c5cddd', 300: '#a1aec8', 400: '#7788ab', 500: '#526689', 600: '#3e4e6e', 700: '#303d57', 800: '#242c41', 900: '#1b2234', 950: '#121824' },
        colorScheme: { light: { primary: { color: '#242C41', inverseColor: '#ffffff', hoverColor: '#303d57', activeColor: '#1b2234' }, highlight: { background: '#fff7da', focusBackground: '#ffedb0', color: '#242c41', focusColor: '#242c41' } } },
        formField: { borderRadius: '8px', focusBorderColor: '#526689' },
        focusRing: { width: '3px', style: 'solid', color: '#F7C83C', offset: '3px' }
    }
});
