import { Inter } from "next/font/google";

import "~/styles/globals.css";
import { Providers } from "~/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className={`${inter.variable} h-full font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
