import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPath = request.nextUrl.pathname.startsWith("/auth");
  const isVendorPath = request.nextUrl.pathname.startsWith("/vendor");
  const isDashboardPath = request.nextUrl.pathname.startsWith("/dashboard");

  const isAuthLogin = request.nextUrl.pathname === "/auth/login";
  const isVendorLogin = request.nextUrl.pathname === "/vendor/login";

  if (!user) {
    // Blocks unauthenticated users from accessing protected routes
    if (isAuthPath && !isAuthLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }
    if (isVendorPath && !isVendorLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/vendor/login";
      return NextResponse.redirect(url);
    }
    if (isDashboardPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }
  } else if (isAuthPath || isVendorPath || isDashboardPath) {
    // Tipe portal dibaca dari tabel `profiles`, bukan user_metadata: metadata
    // bisa ditulis sendiri oleh user lewat supabase.auth.updateUser() dari
    // browser, sehingga vendor bisa mengaku 'internal' dan lolos gate ini.
    // `profiles` adalah sumber kebenaran yang sama dengan yang dipakai kedua
    // login action. Query hanya dijalankan untuk path yang memang di-gate.
    const { data: profile } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', user.id)
      .single();
    const type = profile?.type; // 'internal' atau 'external'

    // 1. Cross-Portal Blocking
    if (type === 'external') {
      // Vendors cannot access internal dashboard or auth login
      if (isDashboardPath || isAuthPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/vendor/dashboard";
        return NextResponse.redirect(url);
      }
      // If they go to vendor login, redirect to vendor dashboard
      if (isVendorLogin) {
        const url = request.nextUrl.clone();
        url.pathname = "/vendor/dashboard";
        return NextResponse.redirect(url);
      }
    } else if (type === 'internal') {
      // Internal cannot access vendor paths
      if (isVendorPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
      // If they go to auth login, redirect to dashboard
      if (isAuthLogin) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
      
      // 2. Dynamic permission checks are now handled in the page/layout components
    } else {
      // Profil tidak ditemukan / tipe tidak dikenal: jangan biarkan lolos ke
      // kedua portal. Halaman login sengaja dibiarkan lewat supaya tidak
      // terjadi redirect loop.
      if (isDashboardPath || (isAuthPath && !isAuthLogin) || (isVendorPath && !isVendorLogin)) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth/login";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
