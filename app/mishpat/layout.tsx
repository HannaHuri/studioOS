export default function MishpatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;500;600&family=Rubik:wght@400;500;600&family=Figtree:wght@400;500;600&display=swap" rel="stylesheet" />
      {children}
    </>
  );
}
