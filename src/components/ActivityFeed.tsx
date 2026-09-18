import type { ActivityFeedItem } from "@/lib/data";
import { SOURCE_LABEL, formatActivityDate } from "@/lib/presentation";

/**
 * Recent-activity list: the objective side of the load number above it
 * (duration, distance, HR, source) plus the RPE once the athlete has
 * checked in. Shared by the athlete's own progress page and the coach's
 * athlete detail view.
 */
export function ActivityFeed({ activities }: { activities: ActivityFeedItem[] }) {
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface px-4 py-6 text-center text-[12.5px] text-muted">
        Nenhuma atividade registrada ainda.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-ink">{formatActivityDate(activity.startedAt)}</span>
              <span className="rounded-[3px] bg-[#f1eee3] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">
                {SOURCE_LABEL[activity.source]}
              </span>
            </div>
            <div className="truncate text-[11.5px] text-muted">
              {activity.durationMin} min
              {activity.distanceKm ? ` · ${activity.distanceKm} km` : ""}
              {activity.avgHr ? ` · ${activity.avgHr} bpm médio` : ""}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end">
            {activity.rpe != null ? (
              <>
                <span className="font-display text-[16px] font-semibold text-ink">{activity.rpe}</span>
                <span className="text-[9.5px] text-muted">RPE</span>
              </>
            ) : (
              <span className="text-[11px] text-muted">sem check-in</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
