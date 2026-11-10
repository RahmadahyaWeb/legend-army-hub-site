import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminClaims } from "@/lib/claims";

// Gerbang area admin (Next 16 `proxy`).
//
// Kenapa di proxy dan bukan di layout: dengan Cache Components, shell statis
// terkirim sebelum render selesai, sehingga `redirect()`/`forbidden()` yang
// dipanggil saat request HANYA bisa mengembalikan status 200 + halaman error.
// Proxy berjalan sebelum render, jadi di sinilah status 307 (ke /login) dan
// 403 (bukan admin) benar-benar bisa dikirim.
//
// Spec: .scratch/guild-league-lineup/spec.md §4.4, §4.5 (US-6 / AC6.1)

/** Halaman 403 mandiri: body-nya tidak boleh bergantung pada CSS/JS aplikasi. */
const FORBIDDEN_HTML = `<!DOCTYPE html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>403 — Forbidden</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #fafafa;
        color: #18181b;
      }
      main { max-width: 28rem; padding: 1.5rem; text-align: center; }
      p.placeholder { margin: 0; font-size: 3rem; font-weight: 700; color: #a1a1aa; }
      h1 { margin: 0.5rem 0 0; font-size: 1.25rem; }
      p { margin: 0.75rem 0 0; color: #52525b; line-height: 1.6; }
      a { display: inline-block; margin-top: 1.5rem; color: #18181b; }
      @media (prefers-color-scheme: dark) {
        body { background: #09090b; color: #fafafa; }
        p { color: #a1a1aa; }
        a { color: #fafafa; }
      }
    </style>
  </head>
  <body>
    <main data-testid="forbidden">
      <p class="placeholder">403</p>
      <h1>Forbidden</h1>
      <p>
        Akun yang sedang login bukan admin Legend Army, jadi area ini tidak
        bisa dibuka.
      </p>
      <a href="/">Kembali ke lineup publik</a>
    </main>
  </body>
</html>`;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // `getClaims()` memverifikasi tanda tangan JWT (JWKS, di-cache) dan
  // kedaluwarsanya, jadi role di bawah bukan bisa dipalsuin dari cookie.
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(
      request.nextUrl.pathname + request.nextUrl.search,
    )}`;
    return NextResponse.redirect(url);
  }

  if (!isAdminClaims(data.claims)) {
    return new NextResponse(FORBIDDEN_HTML, {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
