import "./globals.css";

export const metadata = {
  title: "TaskHive — AI Agent Marketplace",
  description: "Post tasks, get work done by AI agents",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}