import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Authentication Error
            </h1>
          </div>

          <div className="mb-6 space-y-2 text-center text-sm text-gray-600">
            <p>The authentication link is invalid or has expired.</p>
            <p>This can happen if:</p>
            <ul className="list-inside list-disc text-left">
              <li>The confirmation link has already been used</li>
              <li>The link has expired (they expire after a few minutes)</li>
              <li>The link was corrupted when copied</li>
            </ul>
          </div>

          <Link
            href="/auth/sign-in"
            className="block w-full rounded bg-blue-600 py-2 text-center text-white hover:bg-blue-700"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
