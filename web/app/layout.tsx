import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Omniclaw — Integration Manager",
  description: "Manage integrations for Omniclaw",
};

// Static inline script to prevent FOUC on theme load.
// This is a hardcoded string — no user input involved.
const themeScript = `try{if(localStorage.getItem("theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${jakarta.variable} min-h-screen font-[family-name:var(--font-jakarta)] antialiased`}
      >
        {children}
        <Toaster
          richColors
          position="bottom-right"
          toastOptions={{
            className: "font-[family-name:var(--font-jakarta)]",
          }}
        />
      </body>
    </html>
  );
}
