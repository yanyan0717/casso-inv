interface SkeletonProps {
  type?: 'table' | 'stats' | 'form' | 'card' | 'list';
  rows?: number;
  cols?: number;
}

export function SkeletonLoader({ type = 'table', rows = 5, cols = 5 }: SkeletonProps) {
  const shimmerClass = "animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]";

  if (type === 'stats') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-100 rounded-md p-5 shadow-sm border border-gray-200">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full ${shimmerClass}`} />
              <div className="space-y-2 flex-1">
                <div className={`h-3 w-20 rounded ${shimmerClass}`} />
                <div className={`h-5 w-12 rounded ${shimmerClass}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-gray-200">
                {Array.from({ length: cols }).map((_, i) => (
                  <th key={i} className="px-6 py-3">
                    <div className={`h-3 w-20 rounded ${shimmerClass}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Array.from({ length: rows }).map((_, rowIdx) => (
                <tr key={rowIdx} className="border-b border-slate-100">
                  {Array.from({ length: cols }).map((_, colIdx) => (
                    <td key={colIdx} className="px-6 py-3">
                      <div className={`h-4 w-${colIdx === 0 ? '24' : '32'} rounded ${shimmerClass}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="bg-white rounded-md p-5 shadow-sm border border-gray-200">
        <div className="space-y-3">
          <div className={`h-4 w-1/3 rounded ${shimmerClass}`} />
          <div className={`h-3 w-full rounded ${shimmerClass}`} />
          <div className={`h-3 w-2/3 rounded ${shimmerClass}`} />
        </div>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className={`h-5 w-32 rounded ${shimmerClass}`} />
        </div>
        <div className="p-4 space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className={`h-10 w-10 rounded-lg ${shimmerClass}`} />
              <div className="space-y-2 flex-1">
                <div className={`h-4 w-48 rounded ${shimmerClass}`} />
                <div className={`h-3 w-32 rounded ${shimmerClass}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export function TableSkeleton({ rows = 10, cols = 5 }: { rows?: number; cols?: number }) {
  return <SkeletonLoader type="table" rows={rows} cols={cols} />;
}

export function StatsSkeleton() {
  return <SkeletonLoader type="stats" />;
}

export function CardSkeleton() {
  return <SkeletonLoader type="card" />;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return <SkeletonLoader type="list" rows={rows} />;
}