import type { NextRequest } from "next/server";

import { proxyBackend } from "../_proxy";

export function GET(request: NextRequest) {
  return proxyBackend(request, "banner-rankings");
}
