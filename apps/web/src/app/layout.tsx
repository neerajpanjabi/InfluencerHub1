// Root layout is a pass-through; <html> lives in [locale]/layout so lang/dir follow the locale.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
