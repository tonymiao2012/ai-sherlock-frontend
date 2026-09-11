// 主题令牌：配色取自 assets/style.png 与 assets/logo.png
// antd 组件走这里的 ThemeConfig，原生 DOM 走 styles/theme.css 中的同名 CSS 变量
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

  /** 录制等危险态，保留红色语义 */
  danger: '#EC5B56',
  dangerSoft: '#FDEDED',
  dangerLine: '#F5B7B4',
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
      defaultHoverColor: palette.accent,
      defaultActiveColor: palette.accentHover,
      defaultHoverBorderColor: palette.accentLine,
      defaultActiveBorderColor: palette.accent,
    },
    Card: {
      borderRadiusLG: 14,
      colorBorderSecondary: palette.line,
    },
    Input: {
      colorBgContainer: palette.surface,
      hoverBorderColor: palette.accentHover,
      activeBorderColor: palette.accent,
      activeShadow: '0 0 0 3px rgba(103, 184, 32, 0.22)',
    },
    Tag: {
      defaultBg: palette.sunken,
      defaultColor: palette.text,
      borderRadiusSM: 999,
    },
    Tabs: {
      inkBarColor: palette.accent,
      itemHoverColor: palette.ink,
      itemActiveColor: palette.ink,
      itemSelectedColor: palette.accent,
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
