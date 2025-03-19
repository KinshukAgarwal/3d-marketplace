'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  console.error('Auth page error:', error);

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Something went wrong!</h2>
        <p className="text-sm text-gray-500 mt-2">{error.message}</p>
        <button
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}