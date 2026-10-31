/**
 * Design Tokens for CIT Campus Scheduling Platform
 * Standardized across colors, typography, spacing, border radiuses, and shadows.
 * All components reference these tokens to ensure strict visual harmony and WCAG AA contrast.
 */

export const tokens = {
  colors: {
    brand: {
      primary: '#2563EB', // Blue 600
      primaryHover: '#1D4ED8', // Blue 700
      primaryLight: '#EFF6FF', // Blue 50
      primaryBorder: '#BFDBFE', // Blue 200
      accent: '#7C3AED', // Purple 600
      accentLight: '#F5F3FF', // Purple 50
    },
    kinds: {
      lecture: {
        bg: '#EFF6FF',
        text: '#1E40AF',
        border: '#BFDBFE',
        badge: 'Lecture',
      },
      lab: {
        bg: '#ECFDF5',
        text: '#065F46',
        border: '#A7F3D0',
        badge: 'Lab (3h)',
      },
      tutorial: {
        bg: '#FFFBEB',
        text: '#92400E',
        border: '#FDE68A',
        badge: 'Tutorial',
      },
      fixed: {
        bg: '#F5F3FF',
        text: '#5B21B6',
        border: '#DDD6FE',
        badge: 'Fixed Slot',
      },
      exam: {
        bg: '#EEF2FF',
        text: '#3730A3',
        border: '#C7D2FE',
        badge: 'Exam',
      },
      booking: {
        bg: '#FDF2F8',
        text: '#9D174D',
        border: '#FBCFE8',
        badge: 'Event',
      },
    },
    status: {
      success: {
        bg: '#ECFDF5',
        text: '#065F46',
        border: '#A7F3D0',
      },
      warning: {
        bg: '#FFFBEB',
        text: '#92400E',
        border: '#FDE68A',
      },
      error: {
        bg: '#FEF2F2',
        text: '#991B1B',
        border: '#FECACA',
      },
      neutral: {
        bg: '#F8FAFC',
        text: '#334155',
        border: '#E2E8F0',
      },
    },
  },
  touch: {
    minTarget: 'min-h-[44px] min-w-[44px]',
    buttonPadding: 'px-4 py-2.5',
  },
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    full: 'rounded-full',
  },
  shadow: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
  },
};
