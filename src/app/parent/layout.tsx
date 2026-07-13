import ParentGuard from '@/components/layout/ParentGuard'
export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <ParentGuard>{children}</ParentGuard>
}
