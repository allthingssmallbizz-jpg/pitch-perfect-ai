import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <h1 className="mb-2 font-display text-2xl font-semibold text-gradient-silver">Create your account</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        12 months of access to every Pitch Perfect AI generator.
      </p>
      <SignupForm />
    </div>
  );
}
