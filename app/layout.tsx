import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "./components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense Tracker | INR",
  description: "Track your business cashflow and personal expenses",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-100`}
      >
        {/* Mobile Container: Centers the app and gives it a mobile feel on desktop */}
        <div className="flex flex-col min-h-screen max-w-md mx-auto bg-white shadow-xl relative">
          
          {/* Main Content Area */}
          <main className="flex-grow pb-24 px-4 pt-6">
            {children}
          </main>

          {/* Persistent Bottom Navigation */}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}