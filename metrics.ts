/**
 * Minimal Prometheus metrics, rendered in the text exposition format.
 * Label cardinality is bounded: matcher names come from the configuration,
 * methods are normalised and statuses are HTTP status codes.
 */

const DURATION_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30,
];

const KNOWN_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "CONNECT",
  "TRACE",
]);

export interface RequestObservation {
  matcher: string;
  method: string;
  status: string;
  durationSeconds: number;
}

interface Histogram {
  buckets: number[];
  sum: number;
  count: number;
}

function escapeLabel(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
}

function labels(values: Record<string, string>): string {
  const pairs = Object.entries(values).map(
    ([key, value]) => `${key}="${escapeLabel(value)}"`
  );
  return `{${pairs.join(",")}}`;
}

export class Metrics {
  private requests = new Map<string, { labels: object; value: number }>();
  private durations = new Map<string, { matcher: string; h: Histogram }>();
  private inFlight = 0;

  requestStarted() {
    this.inFlight++;
  }

  requestFinished(observation: RequestObservation) {
    this.inFlight--;
    const method = KNOWN_METHODS.has(observation.method)
      ? observation.method
      : "OTHER";

    const requestLabels = {
      matcher: observation.matcher,
      method,
      status: observation.status,
    };
    const requestKey = JSON.stringify(requestLabels);
    const counter = this.requests.get(requestKey) || {
      labels: requestLabels,
      value: 0,
    };
    counter.value++;
    this.requests.set(requestKey, counter);

    let duration = this.durations.get(observation.matcher);
    if (!duration) {
      duration = {
        matcher: observation.matcher,
        h: { buckets: DURATION_BUCKETS.map(() => 0), sum: 0, count: 0 },
      };
      this.durations.set(observation.matcher, duration);
    }
    const h = duration.h;
    DURATION_BUCKETS.forEach((bound, i) => {
      if (observation.durationSeconds <= bound) {
        h.buckets[i]++;
      }
    });
    h.sum += observation.durationSeconds;
    h.count++;
  }

  render(): string {
    const lines: string[] = [];

    lines.push(
      "# HELP donkey_requests_total Requests handled by the gateway.",
      "# TYPE donkey_requests_total counter"
    );
    for (const { labels: l, value } of this.requests.values()) {
      lines.push(
        `donkey_requests_total${labels(l as Record<string, string>)} ${value}`
      );
    }

    lines.push(
      "# HELP donkey_request_duration_seconds Time to fully answer a request.",
      "# TYPE donkey_request_duration_seconds histogram"
    );
    for (const { matcher, h } of this.durations.values()) {
      DURATION_BUCKETS.forEach((bound, i) => {
        lines.push(
          `donkey_request_duration_seconds_bucket${labels({
            matcher,
            le: String(bound),
          })} ${h.buckets[i]}`
        );
      });
      lines.push(
        `donkey_request_duration_seconds_bucket${labels({
          matcher,
          le: "+Inf",
        })} ${h.count}`,
        `donkey_request_duration_seconds_sum${labels({ matcher })} ${h.sum}`,
        `donkey_request_duration_seconds_count${labels({ matcher })} ${h.count}`
      );
    }

    lines.push(
      "# HELP donkey_in_flight_requests Requests currently being handled.",
      "# TYPE donkey_in_flight_requests gauge",
      `donkey_in_flight_requests ${this.inFlight}`
    );

    return lines.join("\n") + "\n";
  }
}
