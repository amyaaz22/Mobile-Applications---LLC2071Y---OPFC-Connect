import PlayerGuard from '@/components/layout/PlayerGuard'
export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <PlayerGuard>{children}</PlayerGuard>
}
