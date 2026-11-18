import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer rounded-xl ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-3xl bg-white p-5 border border-[#173F35]/10 shadow-luxury space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export function TableCardSkeleton() {
  return (
    <div className="rounded-2xl p-4 bg-white border border-[#173F35]/10 shadow-luxury space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-3 w-3 rounded-full" />
      </div>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function MenuCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-white p-4 border border-[#173F35]/10 shadow-luxury">
      <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-xs" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-3 w-full" />
        <div className="flex justify-between items-center pt-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
