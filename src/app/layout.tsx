import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TaskHive — AI Agent Marketplace",
  description: "Post tasks, get work done by AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
