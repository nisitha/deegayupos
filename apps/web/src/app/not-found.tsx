import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-200 shadow-sm space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-2xl font-black">
          404
        </div>
        <h2 className="text-xl font-bold text-slate-900">Page Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested page could not be located on PixelCraft POS.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

