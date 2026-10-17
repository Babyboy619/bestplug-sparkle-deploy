<<<<<<< HEAD
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Gift,
  Hand,
  ReceiptText,
  Rocket,
  ShoppingBag,
  Smartphone,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SiteFrame } from "@/components/site-frame";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard | BESTPLUG MARKETPLACE" },
      { name: "description", content: "Manage your marketplace activity and wallet." },
    ],
  }),
  component: DashboardPage,
});

const shortcuts = [
  { to: "/products", label: "Buy Acc.", icon: ShoppingBag, color: "text-orange-400" },
  { to: "/sms-verify", label: "SMS Verify", icon: Smartphone, color: "text-sky-400" },
  { to: "/pay-bills", label: "Pay Bills", icon: ReceiptText, color: "text-emerald-400" },
  { to: "/boost-accounts", label: "Boost Accounts", icon: Rocket, color: "text-rose-400" },
  { to: "/refer-earn", label: "Refer & Earn", icon: Gift, color: "text-violet-400" },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy, color: "text-amber-300" },
] as const;

function DashboardPage() {
  const { user } = useAuthUser();
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!user) {
      setBalance(null);
      setDisplayName("");
      setAvatarUrl("");
      return;
    }
    let active = true;
    setBalanceLoading(true);
    void Promise.all([
      supabase.rpc("ensure_user_wallet"),
      supabase.from("profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle(),
    ]).then(([{ data, error }, profile]) => {
      if (!active) return;
      if (error) {
        setBalanceError(true);
      } else {
        setBalance(Number(data?.[0]?.balance ?? 0));
        setBalanceError(false);
      }
      setDisplayName(profile.data?.display_name?.trim() ?? "");
      setAvatarUrl(profile.data?.avatar_url ?? "");
      setBalanceLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <SiteFrame>
      <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase text-primary">BESTPLUG MARKETPLACE</p>
          <div className="mt-2 flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="size-10 rounded-full border border-border object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-full border border-border bg-secondary"
              >
                <UserRound className="size-5 text-muted-foreground" />
              </span>
            )}
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Welcome back{displayName ? `, ${displayName}` : ""}
            </h1>
          </div>
        </div>

        <section
          aria-label="Dashboard shortcuts"
          className="grid grid-cols-2 gap-3 min-[360px]:grid-cols-3 sm:gap-4"
        >
          {shortcuts.map(({ to, label, icon: Icon, color }) => (
            <Link
              key={to}
              to={to}
              className="group flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-2 py-4 text-center transition-colors hover:border-primary/60 hover:bg-accent active:scale-[0.98] sm:min-h-32"
            >
              <Icon aria-hidden="true" className={`size-7 ${color}`} />
              <span className="text-xs font-semibold text-card-foreground sm:text-sm">{label}</span>
            </Link>
          ))}
        </section>

        <section className="mt-5 flex flex-col gap-4 rounded-xl bg-slate-100 p-4 text-slate-900 sm:flex-row sm:items-center sm:p-5">
          <Hand aria-hidden="true" className="size-7 shrink-0 text-orange-500" />
          <p className="flex-1 text-sm leading-6">
            New here, or not sure how something works? See a simple walkthrough of everything you
            can do.
          </p>
          <Button asChild className="w-full bg-blue-700 text-white hover:bg-blue-800 sm:w-auto">
            <Link to="/how-it-works">
              How It Works <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </section>

        <section className="mt-5 flex flex-col gap-5 rounded-xl border border-orange-200 bg-orange-50 p-5 text-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-semibold">Wallet Balance</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {balanceLoading
                ? "Loading…"
                : balanceError
                  ? "Balance unavailable"
                  : balance === null
                    ? "Sign in to view"
                    : `₦${balance.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            {!user && (
              <p className="mt-1 text-xs text-slate-600">Your balance is only visible to you.</p>
            )}
          </div>
          <Button asChild className="w-full bg-orange-500 text-white hover:bg-orange-600 sm:w-auto">
            <Link to={user ? "/wallet" : "/auth"}>
              Fund Wallet <Wallet aria-hidden="true" />
            </Link>
          </Button>
        </section>

        <section className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Refer & Earn</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              Referral rewards are not available yet. No referral earnings or rates are configured.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/refer-earn">
              View Referral Link <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </main>
    </SiteFrame>
  );
}
=======
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, ArrowUpRight, Search, ShieldCheck, Wallet, Crown, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import logo from '@/assets/bestplug-logo.jpg.asset.json';
import { SiteFrame } from '@/components/site-frame';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
const platforms: [string,string,string][]=[['TikTok','tiktok','Tk'],['Instagram','instagram','Ig'],['Facebook','facebook','f'],['YouTube','youtube','▶'],['Telegram','telegram','↗'],['Twitter / X','twitter-x','𝕏'],['LinkedIn','linkedin','in']];
export const Route=createFileRoute('/')({head:()=>({meta:[{title:'BESTPLUG MARKETPLACE | Social Media Accounts'},{name:'description',content:'Discover social media account listings at BESTPLUG MARKETPLACE. Browse platforms and shop with secure wallet payments.'},{property:'og:title',content:'BESTPLUG MARKETPLACE | Social Media Accounts'},{property:'og:description',content:'Your plug for social media accounts. Browse platforms and shop with your wallet.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:Index});
function Index(){const [search,setSearch]=useState('');const navigate=useNavigate();return <SiteFrame><main>
 <section className="market-hero"><div className="hero-inner"><img className="hero-logo" src={logo.url} alt="BestPlug gold crown and plug logo"/><div className="hero-copy"><p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Crown className="size-4"/>Your next move starts here</p><h1 className="brand-title hero-title">BESTPLUG<br/><span className="text-primary">MARKETPLACE.</span></h1><p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">Social media accounts for your next big idea.<br className="hidden sm:block"/> Find the right platform. Get plugged in.</p><form className="mt-7 flex max-w-md gap-2" role="search" onSubmit={e=>{e.preventDefault();void navigate({to:'/products',search:{q:search.trim(),category:''}});}}><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-4 size-4 text-muted-foreground"/><Input className="h-12 bg-card pl-9" placeholder="Search accounts & platforms" aria-label="Search accounts" value={search} onChange={e=>setSearch(e.target.value)}/></div><Button className="h-12" aria-label="Search marketplace"><ArrowRight className="size-5"/></Button></form><div className="mt-5 flex flex-wrap gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary"/>Secure checkout</span><span className="flex items-center gap-2"><Wallet className="size-4 text-primary"/>Wallet payments</span></div></div></div></section>
 <section className="border-b border-border"><div className="mx-auto max-w-7xl px-5 py-9 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-primary">Find your platform</p><h2 className="section-heading mt-2">Get connected.</h2></div><Button variant="ghost" asChild><Link to="/products">All accounts<ArrowUpRight className="size-4"/></Link></Button></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{platforms.map(([name,slug,symbol])=><Link className="platform-tile" key={slug} to="/products" search={{category:slug,q:''}}><div><span className="brand-title block text-2xl font-bold text-primary" aria-hidden="true">{symbol}</span><span className="mt-2 block text-xs font-medium">{name}</span></div><ArrowUpRight className="size-4 shrink-0 text-muted-foreground"/></Link>)}</div></div></section>
 <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-primary">The marketplace</p><h2 className="section-heading mt-2">Find your next account.</h2></div><Button asChild><Link to="/products">Browse listings<ArrowRight className="size-4"/></Link></Button></div><div className="mt-7 flex items-center gap-4 border-y border-border py-6"><ShoppingBag className="size-8 shrink-0 text-primary"/><p className="text-sm leading-6 text-muted-foreground">Explore accounts by platform, availability, and price.<br/>Your purchases and delivered details stay in your account.</p></div></section>
 </main></SiteFrame>;}
>>>>>>> a5c80194e6a3b89bef51c0a3a9726f1e0dd469b0
