'use client';

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1F4E79', contrastText: '#FFFFFF' },
    secondary: { main: '#0F766E' },
    background: { default: '#F4F1EA', paper: '#FFFcf7' },
    text: { primary: '#1C1917', secondary: '#57534E' },
    divider: '#E7E0D6',
    success: { main: '#15803D' },
    warning: { main: '#C2410C' },
    error: { main: '#B91C1C' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Source Sans 3", "Segoe UI", sans-serif',
    h1: { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 620 },
    h2: { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 620 },
    h3: { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600 },
    h4: { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600 },
    h5: { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600 },
    h6: { fontWeight: 650 },
    button: { textTransform: 'none', fontWeight: 650 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, paddingInline: 16 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { border: '1px solid #E7E0D6', boxShadow: '0 8px 24px rgba(28, 25, 23, 0.04)' },
      },
    },
  },
});
