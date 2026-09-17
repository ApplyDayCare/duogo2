import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { Sparkles, ShieldCheck, ChevronDown, ChevronUp, Zap, HeartHandshake, Compass } from "lucide-react";
import { calculateQuizCompatibility } from "@/lib/quizScoring";

export interface CompatibilityScoreMeterProps {
  myDimensions?: number[];
  candidateDimensions?: number[];
  fallbackScore?: number;
  compact?: boolean;
  className?: string;
  onScoreCalculated?: (score: number) => void;
}

export const CompatibilityScoreMeter: React.FC<CompatibilityScoreMeterProps> = ({
  myDimensions,
  candidateDimensions,
  fallbackScore = 84,
  compact = false,
  className = "",
  onScoreCalculated,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [displayNumber, setDisplayNumber] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Compute the authentic quiz score data
  const { overallScore: rawOverallScore, breakdown, categories, topSynergies } = useMemo(() => {
    return calculateQuizCompatibility(myDimensions, candidateDimensions, fallbackScore);
  }, [myDimensions, candidateDimensions, fallbackScore]);

  const overallScore = Math.round(rawOverallScore);

  // Inform parent if needed
  useEffect(() => {
    if (onScoreCalculated) {
      onScoreCalculated(overallScore);
    }
  }, [overallScore, onScoreCalculated]);

  // Score tier descriptor
  const tier = useMemo(() => {
    if (overallScore >= 88) {
      return {
        label: "Exceptional Chemistry",
        subtext: "Rare lifestyle & values alignment",
        badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
        pillBg: "bg-emerald-500",
        gradientStart: "#FF7B60",
        gradientEnd: "#FF5436",
      };
    }
    if (overallScore >= 78) {
      return {
        label: "High Resonance",
        subtext: "Strong shared rhythm & energy",
        badgeBg: "bg-[#FFF0EB] text-[#FF5436] border-[#FFD9CE]",
        pillBg: "bg-[#FF5436]",
        gradientStart: "#FFA270",
        gradientEnd: "#FF5436",
      };
    }
    if (overallScore >= 68) {
      return {
        label: "Solid Potential",
        subtext: "Balanced complementary vibes",
        badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
        pillBg: "bg-amber-500",
        gradientStart: "#FCD34D",
        gradientEnd: "#F59E0B",
      };
    }
    return {
      label: "Emerging Match",
      subtext: "Unique perspectives to explore",
      badgeBg: "bg-stone-100 text-stone-700 border-stone-200",
      pillBg: "bg-stone-400",
      gradientStart: "#CBD5E1",
      gradientEnd: "#94A3B8",
    };
  }, [overallScore]);

  // D3 Progress Arc Rendering
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 280;
    const height = 150;
    const centerX = width / 2;
    const centerY = 132;
    const innerRadius = 88;
    const outerRadius = 104;
    const centerRadius = (innerRadius + outerRadius) / 2;

    // 180-degree semi-circle gauge (-90° to +90°)
    const minAngle = -Math.PI / 2;
    const maxAngle = Math.PI / 2;

    // Scale from percentage [0, 100] to angle
    const angleScale = d3
      .scaleLinear()
      .domain([0, 100])
      .range([minAngle, maxAngle])
      .clamp(true);

    const targetAngle = angleScale(overallScore);

    // Defs for gradients and glow filters
    const defs = svg.append("defs");

    // Dynamic gradient along arc
    const gradient = defs
      .append("linearGradient")
      .attr("id", "compatScoreArcGradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    gradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", tier.gradientStart);

    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", tier.gradientEnd);

    // Subtle drop shadow filter for the progress bead
    const filter = defs
      .append("filter")
      .attr("id", "beadGlow")
      .attr("x", "-40%")
      .attr("y", "-40%")
      .attr("width", "180%")
      .attr("height", "180%");

    filter
      .append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 1)
      .attr("stdDeviation", 3)
      .attr("flood-color", tier.gradientEnd)
      .attr("flood-opacity", 0.45);

    const g = svg
      .append("g")
      .attr("transform", `translate(${centerX}, ${centerY})`);

    // D3 Arc Generator for background track
    const backgroundArcGenerator = d3
      .arc<void>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(minAngle)
      .endAngle(maxAngle)
      .cornerRadius(8);

    // Render background track
    g.append("path")
      .attr("d", backgroundArcGenerator())
      .attr("fill", "#F2ECE3");

    // Render subtle scale tick notches (0%, 25%, 50%, 75%, 100%)
    const tickValues = [0, 25, 50, 75, 100];
    const tickGroup = g.append("g").attr("class", "gauge-ticks");

    tickValues.forEach((tickVal) => {
      const angle = angleScale(tickVal);
      const tickInner = innerRadius - 7;
      const tickOuter = innerRadius - 2;
      const x1 = tickInner * Math.sin(angle);
      const y1 = -tickInner * Math.cos(angle);
      const x2 = tickOuter * Math.sin(angle);
      const y2 = -tickOuter * Math.cos(angle);

      tickGroup
        .append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("stroke", tickVal === 50 || tickVal === 0 || tickVal === 100 ? "#B5ABA0" : "#DCD4CA")
        .attr("stroke-width", tickVal === 50 || tickVal === 0 || tickVal === 100 ? 1.5 : 1)
        .attr("stroke-linecap", "round");
    });

    // Foreground Animated Arc Generator
    const foregroundArcGenerator = d3
      .arc<number>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(minAngle)
      .endAngle((d) => d)
      .cornerRadius(8);

    // Path for active progress
    const progressPath = g
      .append("path")
      .datum(minAngle)
      .attr("fill", "url(#compatScoreArcGradient)")
      .attr("d", foregroundArcGenerator as any);

    // Indicator Bead at the arc tip
    const bead = g
      .append("circle")
      .attr("r", 6.5)
      .attr("fill", "#FFFFFF")
      .attr("stroke", tier.gradientEnd)
      .attr("stroke-width", 3)
      .attr("filter", "url(#beadGlow)")
      .attr("opacity", 0);

    // Animate the arc and number smoothly from 0 to overallScore
    const startTime = performance.now();
    const duration = 650;

    progressPath
      .transition()
      .duration(duration)
      .ease(d3.easeCubicOut)
      .attrTween("d", () => {
        const interpolate = d3.interpolate(minAngle, targetAngle);
        return (t: number) => {
          const currentA = interpolate(t);
          const beadX = centerRadius * Math.sin(currentA);
          const beadY = -centerRadius * Math.cos(currentA);
          bead
            .attr("cx", beadX)
            .attr("cy", beadY)
            .attr("opacity", t > 0.05 ? 1 : 0);

          return foregroundArcGenerator(currentA) || "";
        };
      });

    // Animate displayed number
    let animFrame: number;
    const animateNumber = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.round(overallScore * eased);
      setDisplayNumber(currentVal);

      if (progress < 1) {
        animFrame = requestAnimationFrame(animateNumber);
      } else {
        setDisplayNumber(overallScore);
      }
    };

    animFrame = requestAnimationFrame(animateNumber);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [overallScore, tier]);

  const getCategoryIcon = (name: string) => {
    switch (name) {
      case "Lifestyle Foundations":
      case "Anchor Values":
      case "Core Values":
        return <HeartHandshake className="h-3.5 w-3.5 text-primary" />;
      case "Social Battery":
        return <Zap className="h-3.5 w-3.5 text-amber-500" />;
      default:
        return <Compass className="h-3.5 w-3.5 text-emerald-600" />;
    }
  };

  return (
    <div
      id="compatibility-score-meter"
      className={`rounded-[28px] border border-[#EFE8DD] shadow-card bg-white overflow-hidden transition-all ${className}`}
    >
      {/* Header bar */}
      <div className="p-4 sm:p-5 pb-3 border-b border-[#F5EDE3] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF0EB] text-primary shrink-0 shadow-2xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-[#1A1816] leading-tight">
              Quiz Compatibility Index
            </h3>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <ShieldCheck className="h-3 w-3 text-primary" />
              <span>Calculated 100% from 10-dimension quiz responses</span>
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${tier.badgeBg} shadow-2xs`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${tier.pillBg}`} />
          <span>{tier.label}</span>
        </span>
      </div>

      {/* Main Radial Chart Section */}
      <div className="p-4 sm:p-5 pt-4">
        <div className="flex flex-col items-center justify-center">
          {/* D3 SVG Canvas Container with Centered Score */}
          <div className="relative w-full max-w-[280px] h-[155px] flex items-center justify-center mx-auto">
            <svg
              ref={svgRef}
              viewBox="0 0 280 150"
              className="w-full h-full overflow-visible"
              aria-label={`D3 compatibility radial meter showing ${overallScore}% compatibility`}
            />

            {/* Cleanly Centered Score Info */}
            <div className="absolute inset-x-0 bottom-3 flex flex-col items-center justify-center text-center pointer-events-none px-4">
              <div className="flex items-baseline justify-center">
                <span className="font-serif text-4xl sm:text-5xl font-extrabold text-[#1A1816] tracking-tight leading-none">
                  {displayNumber}
                </span>
                <span className="text-xl sm:text-2xl font-bold text-primary font-serif ml-0.5">
                  %
                </span>
              </div>
              <span className="text-[11px] font-bold text-[#706A62] uppercase tracking-wider mt-1.5">
                Authentic Synergy
              </span>
              <span className="text-xs text-muted-foreground max-w-[170px] leading-snug text-center mt-0.5">
                {tier.subtext}
              </span>
            </div>
          </div>

          {/* Scale range labels under the arc endpoints */}
          <div className="w-full max-w-[250px] flex items-center justify-between text-[11px] font-semibold text-[#8C847B] px-2 pt-2">
            <span>0%</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Zero-Bias Quiz Score
            </span>
            <span>100%</span>
          </div>
        </div>

        {/* 3 High-Level Category Alignment Progress Bars */}
        <div className="mt-4 pt-3 border-t border-[#F5EDE3] space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#1A1816]">
            <span>Lifestyle Dimensional Harmony</span>
            <span className="text-[11px] font-normal text-muted-foreground">Weighted Euclidean fit</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
            {categories.map((cat) => (
              <div
                key={cat.name}
                className="rounded-xl bg-[#FAF7F2] border border-[#EFE8DD] p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A1816]">
                    {getCategoryIcon(cat.name)}
                    <span className="truncate">{cat.name}</span>
                  </div>
                  <span className="text-xs font-bold text-primary">{cat.pct}%</span>
                </div>
                {/* Visual mini progress bar */}
                <div className="h-1.5 w-full bg-[#E8E1D5] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FFA270] to-[#FF5436] rounded-full transition-all duration-1000"
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1">
                  {cat.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Top 3 Quiz Synergies Pill Row */}
        {topSynergies.length > 0 && (
          <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#57281B] bg-[#FFF0EB] px-2 py-0.5 rounded-md">
              Top Quiz Alignments:
            </span>
            {topSynergies.map((syn) => (
              <span
                key={syn.id}
                className="inline-flex items-center gap-1 text-[11px] font-medium bg-white border border-[#E8E1D5] rounded-full px-2.5 py-0.5 text-[#5C5752] shadow-2xs"
              >
                <span>{syn.emoji}</span>
                <span>{syn.label}</span>
                <span className="text-emerald-600 font-bold text-[10px]">
                  {syn.matchPct}%
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Expandable Deep Breakdown Toggle */}
        {breakdown.length > 0 && (
          <div className="mt-3 pt-2">
            <button
              id="btn-toggle-quiz-breakdown"
              type="button"
              onClick={() => setShowBreakdown((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-semibold text-[#706A62] hover:text-[#1A1816] py-1.5 px-1 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>
                  {showBreakdown
                    ? "Hide 10-Dimension Quiz Comparison"
                    : "Inspect Full 10-Dimension Quiz Responses"}
                </span>
              </span>
              {showBreakdown ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {showBreakdown && (
              <div className="mt-2 space-y-2 rounded-2xl bg-[#FAF7F2] border border-[#EFE8DD] p-3 text-xs">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-1 border-b border-[#E8E1D5]">
                  <span>Dimension</span>
                  <span>You vs. Match (1-5 Scale)</span>
                  <span>Calculated Alignment</span>
                </div>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {breakdown.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs py-1 border-b border-[#F0EAE0] last:border-0"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="shrink-0">{item.emoji}</span>
                        <span className="truncate font-medium text-[#1A1816]">
                          {item.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 px-3 text-[#706A62] font-mono text-[11px]">
                        <span className="font-semibold text-primary">{item.myScore}</span>
                        <span>vs</span>
                        <span className="font-semibold text-amber-600">{item.theirScore}</span>
                      </div>

                      <div className="text-right font-bold text-foreground w-12 shrink-0">
                        <span
                          className={
                            item.matchPct >= 75
                              ? "text-emerald-700"
                              : item.matchPct >= 50
                              ? "text-amber-700"
                              : "text-muted-foreground"
                          }
                        >
                          {item.matchPct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default CompatibilityScoreMeter;
