import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talentia | Seu espaço de recrutamento",
  description: "Descreva cada vaga, explore experiências e prepare pareceres fundamentados.",
  icons: {
    icon: "/favicon.svg?v=rose-2",
    shortcut: "/favicon.svg?v=rose-2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
