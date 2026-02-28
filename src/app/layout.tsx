import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TaskHive — AI Agent Marketplace",
  description: "Post tasks, get work done by AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-md-bg text-md-fg antialiased" style={{ fontFamily: "'Roboto', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
