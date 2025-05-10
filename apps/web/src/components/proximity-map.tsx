export default function ProximityMap() {
  return (
    <div className="absolute inset-0 bg-gray-900">
      {/* Map grid lines */}
      <div className="absolute inset-0 grid grid-cols-12 grid-rows-12">
        {Array.from({ length: 13 }).map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute h-full w-px bg-purple-900/20"
            style={{ left: `${(i / 12) * 100}%` }}
          ></div>
        ))}
        {Array.from({ length: 13 }).map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute w-full h-px bg-purple-900/20"
            style={{ top: `${(i / 12) * 100}%` }}
          ></div>
        ))}
      </div>

      {/* Radar effect */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[200%] h-[200%] rounded-full border border-purple-500/10 animate-pulse"></div>
        <div
          className="absolute w-[150%] h-[150%] rounded-full border border-purple-500/20 animate-pulse"
          style={{ animationDelay: "0.5s" }}
        ></div>
        <div
          className="absolute w-[100%] h-[100%] rounded-full border border-purple-500/30 animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute w-[50%] h-[50%] rounded-full border border-purple-500/40 animate-pulse"
          style={{ animationDelay: "1.5s" }}
        ></div>
      </div>

      {/* Map features */}
      <div className="absolute inset-0">
        {/* Buildings */}
        <div className="absolute top-[20%] left-[30%] w-[15%] h-[10%] bg-purple-900/30 rounded-md border border-purple-500/20"></div>
        <div className="absolute top-[40%] left-[60%] w-[10%] h-[15%] bg-purple-900/30 rounded-md border border-purple-500/20"></div>
        <div className="absolute top-[60%] left-[25%] w-[12%] h-[12%] bg-purple-900/30 rounded-md border border-purple-500/20"></div>

        {/* Roads */}
        <div className="absolute top-[50%] left-0 w-full h-[2%] bg-purple-700/20"></div>
        <div className="absolute top-0 left-[40%] w-[2%] h-full bg-purple-700/20"></div>

        {/* Points of interest */}
        <div className="absolute top-[35%] left-[45%] w-[5%] h-[5%] bg-purple-500/40 rounded-full border border-purple-500/60 animate-pulse"></div>
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/50"></div>
    </div>
  );
}
