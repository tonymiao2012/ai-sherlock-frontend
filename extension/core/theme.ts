// 主题令牌：配色取自 assets/style.png 与 assets/logo.png
// antd 组件走这里的 ThemeConfig，原生 DOM 走 styles/theme.css 中的同名 CSS 变量
import type { ThemeConfig } from 'antd';

export const palette = {
  /** 品牌色：LOGO 柠檬绿，用于主按钮底色、选中态 */
  brand: '#B4E968',
  brandHover: '#C4EF82',
  brandActive: '#9BD24C',
  /** 品牌色之上的文字（深墨绿） */
  brandInk: '#17240C',
  /** 白底上可读的强调绿（文字/图标） */
  accent: '#527E14',
  accentSoft: '#EDFADE',
  accentLine: '#D9EFC2',

  ink: '#1B2117',
  text: '#454C3F',
  muted: '#8A9184',

  bg: '#F6F7F2',
  surface: '#FFFFFF',
  sunken: '#EEF0E7',
  line: '#E8EAE2',

  /** 录制等危险态，保留红色语义 */
  danger: '#CF1322',
  dangerSoft: '#FFF1F0',
  dangerLine: '#FFCCC7',
} as const;

export const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif";

/** antd 主题：与 styles/theme.css 的 --sh-* 变量同源 */
export const sherlockTheme: ThemeConfig = {
  token: {
    colorPrimary: palette.brand,
    colorPrimaryHover: palette.brandHover,
    colorPrimaryActive: palette.brandActive,
    colorTextLightSolid: palette.brandInk,
    colorLink: palette.accent,
    colorLinkHover: palette.brandActive,

    colorText: palette.text,
    colorTextSecondary: palette.muted,
    colorTextTertiary: palette.muted,
    colorTextHeading: palette.ink,
    colorTextLabel: palette.muted,

    colorBorder: palette.line,
    colorBorderSecondary: palette.line,
    colorSplit: palette.line,

    colorBgLayout: palette.bg,
    colorBgContainer: palette.surface,
    colorBgElevated: palette.surface,

    borderRadius: 10,
    controlHeight: 34,
    fontFamily,
  },
  components: {
    Button: {
      fontWeight: 600,
      primaryShadow: 'none',
      defaultBorderColor: palette.line,
      defaultColor: palette.ink,
    },
    Card: {
      borderRadiusLG: 14,
      colorBorderSecondary: palette.line,
    },
    Input: {
      colorBgContainer: palette.surface,
      hoverBorderColor: palette.brandActive,
      activeBorderColor: palette.brand,
      activeShadow: '0 0 0 3px rgba(180, 233, 104, 0.28)',
    },
    Tag: {
      defaultBg: palette.sunken,
      defaultColor: palette.text,
      borderRadiusSM: 999,
    },
    Tabs: {
      inkBarColor: palette.brandActive,
      itemActiveColor: palette.ink,
      itemSelectedColor: palette.ink,
    },
    Table: {
      headerBg: palette.sunken,
      headerColor: palette.ink,
      borderColor: palette.line,
      rowHoverBg: palette.accentSoft,
    },
    Descriptions: {
      labelBg: palette.sunken,
      titleColor: palette.ink,
    },
    Alert: {
      colorInfoBg: palette.accentSoft,
      colorInfoBorder: palette.accentLine,
    },
  },
};
