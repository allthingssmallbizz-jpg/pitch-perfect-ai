import LoginForm from "./LoginForm";
import CreatorTag from "@/components/CreatorTag";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <>
      <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <h1 className="mb-6 font-display text-2xl font-semibold text-gradient-silver">Log in</h1>
        <LoginForm next={next || "/dashboard"} />
      </div>
      <CreatorTag />
    </>
  );
}
