import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Toaster } from "sonner";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";
import { LiveBackground } from "@/components/live-background";

export const metadata: Metadata = {
  title: "bloi — Invoice Yield Protocol",
  description: "Turn invoices into yield. Automatically. Tokenize B2B invoices as RWAs on Base, earn 3–7% APY via Aave V3, and let an autonomous AI agent optimize your strategy 24/7.",
  keywords: ["invoice financing", "RWA", "DeFi", "Base", "Base Sepolia", "Aave", "yield optimization", "AI agent"],
  openGraph: {
    title: "bloi — Invoice Yield Protocol",
    description: "Turn invoices into yield. Automatically.",
    images: [{ url: "/twitter-cover.png", width: 1500, height: 500 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "bloi — Invoice Yield Protocol",
    description: "Turn invoices into yield. Automatically.",
    images: ["/twitter-cover.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-mono antialiased bg-[#0a0a0a] text-[#e5e5e5] scan-pulse corner-glow">
        <LiveBackground />
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#111111',
              border: '1px solid #1f1f1f',
              color: '#e5e5e5',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            },
          }}
        />
        <KeyboardShortcutsProvider />
      </body>
    </html>
  );
}
