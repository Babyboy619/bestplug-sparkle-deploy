import { Link } from '@tanstack/react-router';
import { ArrowUpRight, UserRound, Wallet, LogOut, ShieldCheck, Home, Store, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import logo from '@/assets/bestplug-logo.jpg.asset.json';
import { Button } from '@/components/ui/button';
import { useAuthUser } from '@/hooks/use-auth-user';
import { supabase } from '@/integrations/supabase/client';

const navItems = [
 { to: '/', label: 'Home', icon: Home, exact: true },
 { to: '/products', label: 'Market', icon: Store, exact: false },
 { to: '/wallet', label: 'Wallet', icon: Wallet, exact: false },
] as const;

export function SiteFrame({ children }: { children: ReactNode }) {
 const { user } = useAuthUser();
 return <div className="site-shell min-h-screen bg-background text-foreground">
  <header className="lux-header"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
   <Link to="/" aria-label="BESTPLUG MARKETPLACE home" className="flex min-w-0 items-center gap-3"><img src={logo.url} alt="BestPlug logo" className="lux-logo"/><span className="brand-title text-sm font-bold leading-tight sm:text-base">BESTPLUG<span className="block text-[10px] font-semibold tracking-[0.2em] text-primary">MARKETPLACE</span></span></Link>
   <nav className="lux-tabs hidden md:flex" aria-label="Main navigation">{navItems.map(item=><Link key={item.to} to={item.to} activeOptions={{exact:item.exact}} className="lux-tab" activeProps={{className:'lux-tab-active'}}>{item.label === 'Market' ? 'Marketplace' : item.label}</Link>)}</nav>
   <div className="flex items-center gap-2"><Button variant="glass" size="icon" asChild><Link to="/products" search={{q:'',category:''}} aria-label="Search marketplace"><Search/></Link></Button>{user ? <Button variant="glass" size="icon" aria-label="Sign out" title="Sign out" onClick={()=>void supabase.auth.signOut()}><LogOut/></Button> : <Button variant="glass" size="icon" asChild><Link to="/auth" aria-label="Sign in"><UserRound/></Link></Button>}<Button asChild size="sm" variant="luxury" className="hidden sm:inline-flex"><Link to="/products">Shop now<ArrowUpRight/></Link></Button></div>
  </div></header>
  <nav aria-label="Mobile navigation" className="lux-dock md:hidden">{navItems.map(({to,label,icon:Icon,exact})=><Link key={to} to={to} activeOptions={{exact}} className="lux-dock-item" activeProps={{className:'lux-dock-active'}}><Icon className="size-5"/><span>{label}</span></Link>)}<Link to={user ? '/wallet' : '/auth'} className="lux-dock-item" activeProps={{className:'lux-dock-active'}}><UserRound className="size-5"/><span>{user ? 'Account' : 'Sign in'}</span></Link></nav>
  {children}
  <footer className="border-t border-border"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-3 sm:px-8"><div><p className="brand-title font-bold">BESTPLUG <span className="text-primary">MARKETPLACE</span></p><p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">Your plug for social media accounts. Find your platform. Make your next move.</p></div><div><p className="text-sm font-semibold">Marketplace</p><Link className="mt-3 block text-sm text-muted-foreground" to="/products">Browse accounts</Link><Link className="mt-3 block text-sm text-muted-foreground" to="/wallet">Wallet & orders</Link></div><div><p className="text-sm font-semibold">Your account</p><Link className="mt-3 block text-sm text-muted-foreground" to="/auth">Sign in or register</Link><p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-primary"/>Secure wallet checkout</p></div></div><div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">© 2026 BESTPLUG MARKETPLACE. All rights reserved.</div></footer>
 </div>;
}