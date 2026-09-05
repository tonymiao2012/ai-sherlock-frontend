/** 构建时 base 可变，静态资源与跨应用链接统一在此声明 */
export const LOGO_URL = `${import.meta.env.BASE_URL}brand/logo.png`;

/** Landing Page 地址：本地 pnpm dev 由 landing-page 提供 */
export const ROOT_URL = import.meta.env.VITE_LANDING_URL || 'http://localhost:5173/';
