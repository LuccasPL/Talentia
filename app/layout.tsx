import type { Metadata } from "next";
import {headers} from 'next/headers';
import "./globals.css";

export const metadata: Metadata = {
  title: "Talentia | Seu espaço de recrutamento",
  description: "Descreva cada vaga, explore experiências e prepare pareceres fundamentados.",
  icons: {
    icon: "/favicon.svg?v=rose-2",
    shortcut: "/favicon.svg?v=rose-2",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonces must be rendered per request, including the login screen.
  await headers();
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
