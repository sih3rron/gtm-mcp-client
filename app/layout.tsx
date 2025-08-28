import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '../components/ui/toaster';
import { ThemeProvider } from '../components/theme-provider';
import { NextAuthProvider } from '../components/NextAuthProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MCP Chat Client',
  description: 'AI-powered chat interface for Miro board analysis and collaboration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <NextAuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}