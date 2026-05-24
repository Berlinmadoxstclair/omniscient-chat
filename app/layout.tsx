import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Omniscient",
  description: "Multi-model AI that picks the right model for every task.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Omniscient",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#090c12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
