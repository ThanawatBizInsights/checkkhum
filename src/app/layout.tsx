import type { Metadata, Viewport } from "next";
import "@fontsource/prompt/600.css";
import "@fontsource/prompt/700.css";
import "@fontsource/ibm-plex-sans-thai-looped/400.css";
import "@fontsource/ibm-plex-sans-thai-looped/500.css";
import "@fontsource/ibm-plex-sans-thai-looped/600.css";
import "./globals.css";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} | ขอใบเสนอราคาประกันรถยนต์ เทียบแผนก่อนตัดสินใจ`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export const viewport: Viewport = {
  themeColor: "#0A2259",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
