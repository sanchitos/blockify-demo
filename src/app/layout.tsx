import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blockify Demo",
  description: "Ingest text into IdeaBlocks, store in Supabase, ask questions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
