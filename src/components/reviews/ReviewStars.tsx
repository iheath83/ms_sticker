interface ReviewStarsProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  count?: number;
}

const SIZE_MAP = { sm: "text-sm", md: "text-base", lg: "text-xl" };

export function ReviewStars({
  rating,
  maxRating = 5,
  size = "md",
  showCount = false,
  count,
}: ReviewStarsProps) {
  const filled = Math.round(rating);
  return (
    <span className={`inline-flex items-center gap-0.5 ${SIZE_MAP[size]}`} aria-label={`${rating} sur ${maxRating} étoiles`}>
      {Array.from({ length: maxRating }, (_, i) => (
        <span key={i} className={i < filled ? "text-yellow-400" : "text-gray-200"}>
          ★
        </span>
      ))}
      {showCount && count !== undefined && (
        <span className="text-gray-400 text-xs ml-1">({count})</span>
      )}
    </span>
  );
}
