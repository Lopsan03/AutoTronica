declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.gif';

interface ImportMetaEnv {
	readonly VITE_SUPABASE_URL?: string;
	readonly VITE_SUPABASE_ANON_KEY?: string;
	readonly VITE_ADMIN_USERNAME?: string;
	readonly VITE_ADMIN_PASSWORD?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
