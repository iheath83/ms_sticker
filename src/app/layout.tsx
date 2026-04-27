import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MS Adhésif — Stickers sur-mesure imprimés en France",
  description:
    "Imprimerie d'autocollants sur-mesure. Vinyle pro, commandes dès 25 pièces, expédition sous 48h depuis Lyon. Épreuve numérique gratuite.",
  keywords: ["stickers", "autocollants", "sur-mesure", "vinyle", "die cut", "impression", "France"],
  openGraph: {
    title: "MS Adhésif — Stickers sur-mesure",
    description: "Impression de stickers vinyle pro. Épreuve gratuite. Livraison 48h.",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
      <body
        style={{
          fontFamily: "var(--font-mono), ui-monospace, 'SF Mono', Menlo, monospace",
        }}
      >
        {children}
      </body>
    </html>
  );
}
