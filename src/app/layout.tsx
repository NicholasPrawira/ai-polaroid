import type { Metadata, Viewport } from "next";
import { Inter, Courier_Prime } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Mechanical/technical readouts: the develop countdown and HUD-style figures.
const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Capture Memory",
  description: "Capture a photo and let it develop like a disposable camera.",
};

export const viewport: Viewport = {
  themeColor: "#131414",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${courierPrime.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
