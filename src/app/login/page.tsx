import { LoginForm } from "@/app/login/login-form";
import { safeRedirectPath } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle
            data-testid="login-title"
            className="text-2xl font-bold tracking-tight"
          >
            Masuk Admin
          </CardTitle>
          <CardDescription>
            Area admin hanya untuk pengelola resmi. Akun dibuat lewat seed,
            tidak ada pendaftaran terbuka.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
