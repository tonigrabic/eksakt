import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";

// Archivo drives the whole UI (--font-sans); Big Shoulders Display is the
// condensed display face used for big scores / point totals (--font-display).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

// Self-hosted "Big Shoulders Display" (variable, 400–900). next/font/google
// only exposes the renamed "Big Shoulders" family — and Turbopack has no
// fallback metrics for it, which produced a build warning. Hosting the woff2
// locally gives us the exact face the design specified and skips the
// Google-metrics lookup entirely (no warning).
const bigShoulders = localFont({
  src: "./fonts/BigShouldersDisplay-latin.woff2",
  variable: "--font-big-shoulders",
  weight: "400 900",
  display: "swap",
  adjustFontFallback: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Eksakt — Football Prediction Leagues",
  description:
    "Predict exact football scores and compete in private leagues with friends",
  other: {
    // Belt-and-suspenders with <html translate="no">: older Chrome builds
    // only honor the meta tag.
    google: "notranslate",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // translate="no" keeps Google Translate from rewriting the DOM — its
    // <font>-tag mutations crash React when live scores update (react#11538).
    <html lang="en" translate="no" className="dark">
      <body
        className={`${archivo.variable} ${bigShoulders.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
