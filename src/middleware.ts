import { updateSession } from "@/lib/supabase-middleware";
import { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - api routes (they handle their own auth)
     * - _next/static, _next/image
     * - favicon, images
     */
    "/((?!api|_next/static|_next/image|favicon.ico|skill\\.md|skills/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|md)$).*)",
  ],
};
