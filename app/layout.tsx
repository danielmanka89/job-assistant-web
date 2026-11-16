import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import { ThemeAccent } from "@/components/theme-accent";
import { ACCENT_INIT_SCRIPT } from "@/lib/theme-color";
import { ThemeSync } from "@/components/theme-toggle";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Job Assistant", template: "%s · Job Assistant" },
  description: "Tailor your resume to any job description and download it as .docx or .pdf.",
  applicationName: "Job Assistant",
  // Installed from the Home Screen on iPhone and iPad, the site opens full screen like an app.
  appleWebApp: { capable: true, title: "Job Assistant", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the init scripts may set data-theme / data-accent before React hydrates.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + ACCENT_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        {children}
        <ThemeSync />
        <ThemeAccent />
      </body>
    </html>
  );
}
