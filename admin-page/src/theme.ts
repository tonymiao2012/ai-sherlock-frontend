// 主题令牌：与 Chrome 插件 extension/core/theme.ts 同源
// 改动配色时两处一起改，保证中台与插件视觉一致
import type { ThemeConfig } from 'antd';

export const palette = {
  brand: '#B4E968',
  brandHover: '#C4EF82',
  brandActive: '#9BD24C',
  brandInk: '#17240C',
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

  danger: '#CF1322',
  dangerSoft: '#FFF1F0',
  dangerLine: '#FFCCC7',
} as const;

export const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif";

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
      hoverBorderColor: palette.brandActive,
      activeBorderColor: palette.brand,
      activeShadow: '0 0 0 3px rgba(180, 233, 104, 0.28)',
    },
    Tag: {
      defaultBg: palette.sunken,
      defaultColor: palette.text,
      borderRadiusSM: 999,
    },
    Progress: {
      defaultColor: palette.brand,
      remainingColor: palette.sunken,
    },
    Menu: {
      itemSelectedBg: palette.accentSoft,
      itemSelectedColor: palette.ink,
      itemActiveBg: palette.accentSoft,
      itemHoverBg: palette.sunken,
      iconSize: 16,
    },
    Layout: {
      headerBg: palette.surface,
      bodyBg: palette.bg,
      siderBg: palette.surface,
    },
    Table: {
      headerBg: palette.sunken,
      headerColor: palette.ink,
      borderColor: palette.line,
      rowHoverBg: palette.accentSoft,
    },
  },
};
