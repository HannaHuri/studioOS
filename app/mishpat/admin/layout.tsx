// Admin page renders standalone — no sidebar or app shell
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
