import Link from "next/link";
import { ASSET_GENERATORS, ASSET_TYPES } from "@/lib/ai/generators";

export default function Home() {
  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Turn your offer into a webinar, VSL, and launch sequence — in minutes.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-600">
          Pitch Perfect AI runs the exact Discovery → Positioning → Presentation system behind
          every high-converting webinar and sales asset, wrapped in an app built for your
          12-month program access.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-500"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-neutral-300 px-5 py-3 font-medium hover:bg-neutral-100"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24">
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Every asset generator, one brain
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ASSET_TYPES.map((type) => {
            const gen = ASSET_GENERATORS[type];
            return (
              <div key={type} className="rounded-lg border border-neutral-200 bg-white p-5">
                <h3 className="font-semibold">{gen.label}</h3>
                <p className="mt-1 text-sm text-neutral-600">{gen.description}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
