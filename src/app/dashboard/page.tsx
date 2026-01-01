import { Suspense } from "react";
import { DashboardContent } from "./_components/dashboard-content";

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Tasks Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Weekly view of your tasks and projects
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 bg-gray-200 rounded animate-pulse" />
      <div className="h-96 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}
