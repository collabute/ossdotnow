export const env = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001',
  VITE_PUBLIC_ENV: import.meta.env.VITE_PUBLIC_ENV ?? import.meta.env.MODE,
  VITE_DATABUDDY_CLIENT_ID: import.meta.env.VITE_DATABUDDY_CLIENT_ID,
  PROD: import.meta.env.PROD,
};
