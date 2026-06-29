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

  const isAuthLogin = request.nextUrl.pathname === "/auth/login";
  const isVendorLogin = request.nextUrl.pathname === "/vendor/login";

  // Note: For a real app, we should check user.app_metadata.role to ensure strict segregation.
  // For MVP, we will rely on basic path protection.

  if (!user) {
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
  } else {
    // User is logged in
    if (isAuthLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/dashboard";
      return NextResponse.redirect(url);
    }
    if (isVendorLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/vendor/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
