import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Green Embassy - Table Order",
  description: "Seamless QR ordering for restaurants",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-[#E8B95B] selection:text-[#173F35]">
        {children}
      </body>
    </html>
  );
}
