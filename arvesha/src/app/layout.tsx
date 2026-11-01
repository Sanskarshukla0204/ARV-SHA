import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import SplashScreen from "../components/splash/SplashScreen";
import { ConsentNotice } from "../components/ConsentNotice";
const display = Cormorant_Garamond({
  subsets: ["latin"],
    weight: ["400", "500", "600"],
      variable: "--font-display",
        display: "swap",
        });

        const body = Inter({
          subsets: ["latin"],
            variable: "--font-body",
              display: "swap",
              });

              export const metadata: Metadata = {
                title: "Arvésha Clothing",
                  description: "Arvésha Clothing",
                    icons: {
                        icon: [
                              { url: "/favicon.ico", sizes: "48x48" },
                                    { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
                                          { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
                                              ],
                                                  apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
                                                    },
                                                      manifest: "/manifest.webmanifest",
                                                      };

                                                      export const viewport: Viewport = {
                                                        width: "device-width",
                                                          initialScale: 1,
                                                            themeColor: "#f0f1ee",
                                                              colorScheme: "light",
                                                              };

                                                              export default function RootLayout({
                                                                children,
                                                                }: {
                                                                  children: React.ReactNode;
                                                                  }) {
                                                                    return (
                                                                        <html lang="en-IN" className={`${display.variable} ${body.variable}`}>
                                                                              <body>
                                                                                      <SplashScreen />
                                                                                              {children}
                                                                                                      <ConsentNotice />
                                                                                                            </body>
                                                                                                                </html>
                                                                                                                  );
                                                                                                                  }