import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Green Embassy - Table Order",
  description: "Seamless QR ordering for restaurants",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-[#E7B94F] selection:text-[#193A2D]">
        {children}
      </body>
    </html>
  );
}
