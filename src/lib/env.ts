const cleanEnvValue = (value: unknown, fallback?: string) => {
  if (typeof value !== 'string') return fallback;

  return value.replace(/\\n/g, '\n').trim();
};

export const env = {
  VITE_API_BASE_URL: cleanEnvValue(import.meta.env.VITE_API_BASE_URL, 'http://localhost:3001'),
  VITE_PUBLIC_ENV: cleanEnvValue(import.meta.env.VITE_PUBLIC_ENV, import.meta.env.MODE),
  VITE_DATABUDDY_CLIENT_ID: cleanEnvValue(import.meta.env.VITE_DATABUDDY_CLIENT_ID),
  PROD: import.meta.env.PROD,
};
