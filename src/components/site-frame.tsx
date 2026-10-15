import { Link } from '@tanstack/react-router';
import { ArrowUpRight, UserRound, Wallet, LogOut, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import logo from '@/assets/bestplug-logo.jpg.asset.json';
import { Button } from '@/components/ui/button';
import { useAuthUser } from '@/hooks/use-auth-user';
import { supabase } from '@/integrations/supabase/client';

export function SiteFrame({ children }: { children: ReactNode }) {
 const { user } = useAuthUser();
 return <div className="min-h-screen bg-background text-foreground">
  <header className="border-b border-border"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
   <Link to="/" aria-label="BESTPLUG MARKETPLACE home" className="flex min-w-0 items-center gap-2"><img src={logo.url} alt="BestPlug logo" className="size-12 shrink-0 object-contain"/><span className="brand-title text-sm font-bold leading-tight sm:text-lg">BESTPLUG<span className="block text-[10px] font-medium text-primary sm:text-xs">MARKETPLACE</span></span></Link>
   <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation"><Link to="/" activeProps={{className:'text-primary'}} className="text-sm">Home</Link><Link to="/products" className="text-sm">Marketplace</Link><Link to="/wallet" className="text-sm">My wallet</Link></nav>
   <div className="flex items-center gap-2">{user ? <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={()=>void supabase.auth.signOut()}><LogOut className="size-4"/></Button> : <Button variant="ghost" size="icon" asChild><Link to="/auth" aria-label="Sign in"><UserRound className="size-4"/></Link></Button>}<Button asChild size="sm"><Link to="/products">Shop now<ArrowUpRight className="size-4"/></Link></Button></div>
  </div><nav aria-label="Mobile navigation" className="flex justify-center gap-8 border-t border-border px-4 py-3 text-xs md:hidden"><Link to="/">Home</Link><Link to="/products">Marketplace</Link><Link to="/wallet" className="flex items-center gap-1"><Wallet className="size-3"/>Wallet</Link></nav></header>
  {children}
  <footer className="border-t border-border"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-3 sm:px-8"><div><p className="brand-title font-bold">BESTPLUG <span className="text-primary">MARKETPLACE</span></p><p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">Your plug for social media accounts. Find your platform. Make your next move.</p></div><div><p className="text-sm font-semibold">Marketplace</p><Link className="mt-3 block text-sm text-muted-foreground" to="/products">Browse accounts</Link><Link className="mt-3 block text-sm text-muted-foreground" to="/wallet">Wallet & orders</Link></div><div><p className="text-sm font-semibold">Your account</p><Link className="mt-3 block text-sm text-muted-foreground" to="/auth">Sign in or register</Link><p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-primary"/>Secure wallet checkout</p></div></div><div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">© 2026 BESTPLUG MARKETPLACE. All rights reserved.</div></footer>
 </div>;
}