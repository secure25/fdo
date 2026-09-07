import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6 py-12">
      <AuthForm mode="login" />
    </div>
  );
}
