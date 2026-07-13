import CoachGuard from '@/components/layout/CoachGuard'
export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return <CoachGuard>{children}</CoachGuard>
}
