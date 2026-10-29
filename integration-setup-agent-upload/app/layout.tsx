import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Integration Setup Agent: what it takes to connect any app", template: "%s · Integration Setup Agent" },
  description:
    "An AI agent that tells you what it takes to connect any app to your product: OAuth setup, approval, time, blockers and what it can do for you. Every claim tested, sourced or marked as a guess.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
          <nav className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-3 sm:gap-5 text-sm whitespace-nowrap">
            <Link href="/" className="font-semibold tracking-tight flex items-center gap-2">
              <span aria-hidden className="inline-block size-5 rounded-md bg-accent" />
              <span className="hidden sm:inline">Integration Setup Agent</span>
              <span className="sm:hidden">Setup Agent</span>
            </Link>
            <span className="flex-1" />
            <Link href="/#library" className="text-muted hover:text-fg">Library</Link>
            <Link href="/new" className="text-muted hover:text-fg">New guide</Link>
            <Link href="/method" className="hidden sm:inline text-muted hover:text-fg">How it works</Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border text-xs text-faint">
          <div className="mx-auto max-w-5xl px-4 py-6">
            Integration Setup Agent is a take-home project for Composio&apos;s APM Integrations role. It isn&apos;t affiliated with
            the providers it covers. Provider rules change, so check each guide&apos;s date and sources before you rely on it.
          </div>
        </footer>
      </body>
    </html>
  );
}
