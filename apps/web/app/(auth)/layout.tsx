import { AuthShell } from '@/components/auth/auth-shell'

/* Shared by /login and /register: the logo and the showcase stay mounted while
   the form swaps, so moving between the two pages does not reload the panel. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>
}
