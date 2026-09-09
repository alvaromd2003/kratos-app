import type { Metadata, Viewport } from "next";
import { Work_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kratos",
  description: "Pide y gestiona pedidos por QR, sin esperar al camarero.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kratos",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B192C",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${workSans.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
