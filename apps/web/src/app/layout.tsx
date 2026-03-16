import { DialRoot } from "dialkit";
import { Inter } from "next/font/google";

import "../styles/globals.css";
import "dialkit/styles.css";
import localFont from "next/font/local";
import Script from "next/script";

import { Providers } from "~/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const berkeleyMono = localFont({
  src: [
    {
      path: "../../public/BerkeleyMono-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/BerkeleyMono-Oblique.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/BerkeleyMono-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/BerkeleyMono-Bold-Oblique.ttf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-berkeley-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body className={`${inter.variable} ${berkeleyMono.variable} h-full font-sans`}>
        <Providers>{children}</Providers>
        <DialRoot />
      </body>
    </html>
  );
}
