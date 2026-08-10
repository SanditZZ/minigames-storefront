package httpapi

import (
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"github.com/sanditzz/minigames-storefront/backend/internal/i18n"
)

// staleAfter is how long an IP's bucket survives with no requests before
// eviction, so a venue with rotating customer devices does not grow the map
// forever. It is comfortably longer than any legitimate polling interval in
// this app (a catalog/settings refresh, not sub-minute).
const staleAfter = 10 * time.Minute

// ipRateLimiter hands out one token bucket per client IP. It is deliberately
// in-memory and per-process — this API runs as a single Go binary with no
// shared cache, so a distributed limiter would be solving a problem this
// deployment does not have.
type ipRateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	rps     rate.Limit
	burst   int
}

type bucket struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// newIPRateLimiter builds a limiter admitting perMinute requests per IP on
// average, with burst allowed above that instantaneously — enough for a
// landing screen's near-simultaneous reads (catalog, settings, prize
// showcase) without opening the door to enumeration of score ids.
func newIPRateLimiter(perMinute, burst int) *ipRateLimiter {
	return &ipRateLimiter{
		buckets: make(map[string]*bucket),
		rps:     rate.Limit(float64(perMinute) / 60),
		burst:   burst,
	}
}

func (l *ipRateLimiter) allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	for k, b := range l.buckets {
		if now.Sub(b.lastSeen) > staleAfter {
			delete(l.buckets, k)
		}
	}

	b, ok := l.buckets[ip]
	if !ok {
		b = &bucket{limiter: rate.NewLimiter(l.rps, l.burst)}
		l.buckets[ip] = b
	}
	b.lastSeen = now
	return b.limiter.Allow()
}

// clientIP reads the connecting socket's address. There is no reverse proxy
// in front of this server — scripts/serve-prod.sh binds the Go binary
// directly to the public address — so X-Forwarded-For is never trusted here;
// honoring it today would let any caller pick its own rate-limit bucket.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// rateLimited wraps a public handler with a per-IP limit, matching the shape
// of requireAdmin: a route-scoped decorator applied at registration rather
// than a global middleware, since only the unauthenticated reads need it —
// see the "Rate-limit the public reads" entry this closes in
// docs/potential-features.md for which three routes and why.
func rateLimited(limiter *ipRateLimiter, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !limiter.allow(clientIP(r)) {
			writeMessage(w, localeOf(r), http.StatusTooManyRequests, i18n.MsgTooManyRequests)
			return
		}
		h(w, r)
	}
}
