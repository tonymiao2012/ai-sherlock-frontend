// 主题令牌：与 Chrome 插件 extension/core/theme.ts 同源
// 改动配色时两处一起改，保证中台与插件视觉一致
import type { ThemeConfig } from 'antd';

export const palette = {
  /** 浅绿：主按钮底色，配深墨字 */
  brand: '#B4E968',
  brandHover: '#C4EF82',
  brandActive: '#9BD24C',
  /** 浅绿底之上的文字（深墨字） */
  brandInk: '#17240C',
  /** 品牌绿：白底上的强调文字/链接/选中态 */
  accent: '#67B820',
  accentHover: '#57A31B',
  accentActive: '#47890F',
  /** 淡绿：选中/悬停的柔和底色 */
  accentSoft: '#F3FAE9',
  accentLine: '#D7EFBB',
  /** 淡绿底上的文字（深绿字） */
  accentDark: '#68B81F',

  ink: '#141414',
  text: '#141414',
  muted: '#838280',

  bg: '#F2F4F2',
  surface: '#FFFFFF',
  sunken: '#F3F3F3',
  line: '#DDDDDD',

  danger: '#EC5B56',
  dangerSoft: '#FDEDED',
  dangerLine: '#F5B7B4',
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
    colorLinkHover: palette.accentHover,

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
      hoverBorderColor: palette.accentHover,
      activeBorderColor: palette.accent,
      activeShadow: '0 0 0 3px rgba(103, 184, 32, 0.22)',
    },
    Tag: {
      defaultBg: palette.sunken,
      defaultColor: palette.text,
      borderRadiusSM: 999,
    },
    Progress: {
      defaultColor: palette.accent,
      remainingColor: palette.sunken,
    },
    Menu: {
      itemSelectedBg: palette.accentSoft,
      itemSelectedColor: palette.accentDark,
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
    Tabs: {
      inkBarColor: palette.accent,
      itemActiveColor: palette.accent,
      itemSelectedColor: palette.accent,
      itemHoverColor: palette.text,
    },
  },
};
