import { Inter } from "next/font/google";
import localFont from "next/font/local";

import "~/styles/globals.css";
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
    <html lang="en" suppressHydrationWarning className="h-full">
      <body
        className={`${inter.variable} ${berkeleyMono.variable} h-full font-sans`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
