import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vali Health • Shift Backfilling",
  description: "Reactive backfill engine demo (Supabase + LangGraph + Twilio/Vapi).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-50`}
      >
        <div className="border-b border-black/10 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black/40">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Vali Health • Prototype
            </Link>
            <nav className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
              <Link className="hover:underline" href="/admin">
                Admin
              </Link>
              <Link className="hover:underline" href="/caregiver">
                Caregiver
              </Link>
              <Link className="hover:underline" href="/client">
                Client
              </Link>
            </nav>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
