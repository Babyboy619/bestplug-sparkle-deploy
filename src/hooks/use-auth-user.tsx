import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
const AuthContext = createContext<{user:User|null;loading:boolean}>({user:null,loading:true});
export function AuthProvider({children}:{children:ReactNode}) {
 const [user,setUser]=useState<User|null>(null); const [loading,setLoading]=useState(true);
 useEffect(()=>{ let active=true; void supabase.auth.getUser().then(({data})=>{if(active){setUser(data.user);setLoading(false);}}); const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event)){setUser(session?.user??null);setLoading(false);}}); return ()=>{active=false;data.subscription.unsubscribe();}; },[]);
 return <AuthContext.Provider value={{user,loading}}>{children}</AuthContext.Provider>;
}
export const useAuthUser=()=>useContext(AuthContext);