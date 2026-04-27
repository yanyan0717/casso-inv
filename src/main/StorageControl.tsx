import { Link } from 'react-router-dom';
import { ClipboardList, BookOpen } from 'lucide-react';

export default function StorageControl() {
  return (
    <div className="flex flex-col space-y-4 w-full max-w-full pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 font-[var(--heading)] tracking-tight">Storage Control</h2>
          <p className="text-sm text-gray-600 mt-1 font-medium">
            Access the request history and material activity logs in one centralized workspace.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Link
          to="/storage-control/orders-history"
          className="group block rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-[0.2em]">Orders History</p>
              <h3 className="mt-2 text-lg font-bold text-gray-800">Review expired request records</h3>
            </div>
          </div>
          <p className="text-sm text-gray-600">Browse approved and rejected order history that is retained for 30 days before cleanup.</p>
        </Link>

        <Link
          to="/storage-control/logs"
          className="group block rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-3xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-[0.2em]">Material Logs</p>
              <h3 className="mt-2 text-lg font-bold text-gray-800">See audit trails and retention status</h3>
            </div>
          </div>
          <p className="text-sm text-gray-600">Check your activity logs and watch for entries approaching automatic deletion.</p>
        </Link>
      </div>
    </div>
  );
}
