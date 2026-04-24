import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrantShield — Portfolio",
  description: "Federal grant risk oversight",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
