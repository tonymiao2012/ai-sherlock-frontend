/** 构建时 base 可变，静态资源统一走 BASE_URL 拼接 */
export const LOGO_URL = `${import.meta.env.BASE_URL}brand/logo.png`;

/** 登录入口跳转的中台控制台地址（本地 pnpm dev 时由 admin-page 提供） */
export const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || '/admin/';

/**
 * 插件商店地址。未配置时落到 Chrome 应用商店首页（可用但不是详情页），
 * 上线前把 VITE_CHROME_STORE_URL 填成 listing 的完整链接。
 */
export const CHROME_STORE_URL =
  import.meta.env.VITE_CHROME_STORE_URL || 'https://chromewebstore.google.com';
