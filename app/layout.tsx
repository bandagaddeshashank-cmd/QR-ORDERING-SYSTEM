import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});
const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: "Table Order",
  description: "Order from your table",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${bricolage.variable} ${plex.variable}`}
        style={{ fontFamily: "var(--font-bricolage), system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}