import ForgotPasswordForm from "./ForgotPasswordForm";
import CreatorTag from "@/components/CreatorTag";

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <h1 className="mb-2 font-display text-2xl font-semibold text-gradient-silver">Forgot password</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>
        <ForgotPasswordForm />
      </div>
      <CreatorTag />
    </>
  );
}
