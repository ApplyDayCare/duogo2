import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const MatchesSkeleton: React.FC = () => {
  return (
    <div
      id="matches-skeleton-loader"
      className="flex w-full flex-col bg-[#FAF7F2] dark:bg-background px-4 sm:px-6 lg:px-8 py-5 lg:py-6 lg:h-full lg:max-h-screen lg:justify-between animate-in fade-in duration-300"
      aria-label="Loading candidate matches..."
    >
      <div className="w-full max-w-6xl mx-auto flex flex-col lg:h-full lg:min-h-0 space-y-4">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-36 sm:w-44 rounded-xl bg-[#EFE8DD]" />
            <Skeleton className="h-4 w-72 sm:w-96 rounded-md bg-[#EFE8DD]" />
          </div>

          {/* Tab Switcher Skeleton */}
          <div className="flex items-center gap-1.5 p-1 bg-[#EAE3D6] rounded-full w-fit">
            <Skeleton className="h-9 w-24 rounded-full bg-white shadow-2xs" />
            <Skeleton className="h-9 w-24 rounded-full bg-transparent" />
            <Skeleton className="h-9 w-24 rounded-full bg-transparent" />
          </div>
        </div>

        {/* Candidate Counter Bar Skeleton */}
        <div className="flex items-center justify-between px-1 shrink-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full bg-[#EFE8DD]" />
            <Skeleton className="h-4 w-32 rounded-md bg-[#EFE8DD]" />
          </div>
          <Skeleton className="h-4 w-52 rounded-md bg-[#EFE8DD] hidden sm:block" />
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 lg:min-h-0 lg:flex-1 items-stretch">
          {/* LEFT COLUMN: Match Card Skeleton */}
          <div className="lg:col-span-5 flex flex-col lg:min-h-0 relative">
            <div className="h-full rounded-[28px] border border-[#EFE8DD] bg-white shadow-card p-6 sm:p-7 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                {/* Header Badges */}
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-7 w-32 rounded-full bg-[#F5EDE3]" />
                  <Skeleton className="h-7 w-24 rounded-full bg-[#F5EDE3]" />
                </div>

                {/* Identity & Visual Avatar Center */}
                <div className="flex flex-col items-center text-center pt-1 pb-0.5 space-y-3">
                  {/* Avatar / Aura Circle Skeleton */}
                  <div className="relative flex items-center justify-center">
                    <Skeleton className="h-18 w-18 rounded-full bg-gradient-to-br from-[#FFEBE5] to-[#FFD9CE] border-2 border-[#FFC8B8]" />
                  </div>

                  <div className="space-y-1.5 flex flex-col items-center w-full">
                    <Skeleton className="h-6 w-44 rounded-lg bg-[#EFE8DD]" />
                    <Skeleton className="h-3.5 w-60 max-w-full rounded-md bg-[#F5EDE3]" />
                  </div>
                </div>

                {/* Shared Vibes Pill Row Skeleton */}
                <div className="flex flex-wrap justify-center gap-2 pt-0.5">
                  <Skeleton className="h-6 w-24 rounded-full bg-[#FAF7F2] border border-[#E8E1D5]" />
                  <Skeleton className="h-6 w-24 rounded-full bg-[#FAF7F2] border border-[#E8E1D5]" />
                </div>
              </div>

              {/* Action Buttons Footer Skeleton */}
              <div className="pt-4 border-t border-[#F2ECE3] mt-auto space-y-2">
                <div className="flex gap-3">
                  <Skeleton className="h-12 flex-1 rounded-2xl bg-[#FAF7F2] border-2 border-[#EFE8DD]" />
                  <Skeleton className="h-12 flex-1 rounded-2xl bg-[#FFE4DC]" />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Compatibility Score Meter on Top + Dimensions Radar Below */}
          <div className="lg:col-span-7 flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto pr-0.5">
            {/* Compatibility Score Meter Hero Card Skeleton */}
            <div className="rounded-[28px] border border-[#EFE8DD] shadow-card bg-white overflow-hidden">
              {/* Header Bar */}
              <div className="p-4 sm:p-5 pb-2 border-b border-[#F5EDE3] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-xl bg-[#FFEBE5]" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-44 rounded-md bg-[#EFE8DD]" />
                    <Skeleton className="h-3.5 w-60 rounded bg-[#F5EDE3]" />
                  </div>
                </div>
                <Skeleton className="h-6 w-24 rounded-full bg-[#F5EDE3]" />
              </div>

              {/* Radial Meter Canvas Skeleton */}
              <div className="p-4 sm:p-5 pt-4">
                <div className="relative flex flex-col items-center justify-center">
                  <div className="relative w-full max-w-[280px] h-[160px] flex items-center justify-center mx-auto">
                    {/* Gauge Arc Outline Skeleton */}
                    <div className="h-36 w-36 rounded-full border-[10px] border-dashed border-[#F5EDE3] border-b-transparent flex items-center justify-center">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <Skeleton className="h-8 w-14 rounded-lg bg-[#EFE8DD]" />
                        <Skeleton className="h-3 w-16 rounded bg-[#F5EDE3]" />
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-[240px] flex items-center justify-between px-3 -mt-1">
                    <Skeleton className="h-3 w-8 rounded bg-[#F5EDE3]" />
                    <Skeleton className="h-3 w-28 rounded bg-[#F5EDE3]" />
                    <Skeleton className="h-3 w-8 rounded bg-[#F5EDE3]" />
                  </div>
                </div>

                {/* 3 Category Alignment Progress Bars Skeleton */}
                <div className="mt-4 pt-3 border-t border-[#F5EDE3] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-44 rounded bg-[#EFE8DD]" />
                    <Skeleton className="h-3 w-28 rounded bg-[#F5EDE3]" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-[#FAF7F2] border border-[#EFE8DD] p-2.5 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-20 rounded bg-[#EAE3D6]" />
                          <Skeleton className="h-4 w-8 rounded bg-[#EAE3D6]" />
                        </div>
                        <Skeleton className="h-1.5 w-full rounded-full bg-[#E5DDD0]" />
                        <Skeleton className="h-3 w-16 rounded bg-[#EAE3D6]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Compatibility Dimensions Radar Skeleton */}
            <div className="rounded-[28px] border border-[#EFE8DD] shadow-card bg-white p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-48 rounded bg-[#EFE8DD]" />
                  <Skeleton className="h-3 w-56 rounded bg-[#F5EDE3]" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-16 rounded bg-[#F5EDE3]" />
                  <Skeleton className="h-4 w-20 rounded bg-[#F5EDE3]" />
                </div>
              </div>

              <div className="h-[200px] w-full flex items-center justify-center">
                <div className="h-44 w-44 rounded-full border-2 border-dashed border-[#EFE8DD] flex items-center justify-center">
                  <Skeleton className="h-28 w-28 rounded-full bg-[#FAF7F2]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchesSkeleton;
