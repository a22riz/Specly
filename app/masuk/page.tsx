import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "@/components/auth-form";
import { getSessionUser } from "@/lib/auth";

export const instant = false;

export default async function MasukPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <main className="animate-fade-up mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Masuk ke Specly</CardTitle>
        </CardHeader>
        <CardContent>
          <AuthForm mode="masuk" />
        </CardContent>
      </Card>
    </main>
  );
}
