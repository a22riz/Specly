import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "@/components/auth-form";
import { getSessionUser } from "@/lib/auth";

export const instant = false;

export default async function DaftarPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Buat akun Specly</CardTitle>
        </CardHeader>
        <CardContent>
          <AuthForm mode="daftar" />
        </CardContent>
      </Card>
    </main>
  );
}
