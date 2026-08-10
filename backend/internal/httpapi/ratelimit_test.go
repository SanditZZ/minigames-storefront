package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestIPRateLimiterAllowsUpToBurstThenDenies(t *testing.T) {
	l := newIPRateLimiter(60, 3) // 1/sec refill, burst 3

	for i := 0; i < 3; i++ {
		if !l.allow("1.2.3.4") {
			t.Fatalf("request %d within burst was denied", i+1)
		}
	}
	if l.allow("1.2.3.4") {
		t.Fatal("request beyond burst was allowed")
	}
}

func TestIPRateLimiterTracksIPsIndependently(t *testing.T) {
	l := newIPRateLimiter(60, 1)

	if !l.allow("1.2.3.4") {
		t.Fatal("first request from 1.2.3.4 was denied")
	}
	if !l.allow("5.6.7.8") {
		t.Fatal("a different IP was denied by another IP's bucket")
	}
	if l.allow("1.2.3.4") {
		t.Fatal("1.2.3.4's second request beat its own burst of 1")
	}
}

// A bucket idle longer than staleAfter is swept on the next allow() call from
// any IP, so a venue with rotating customer devices does not grow the map
// forever.
func TestIPRateLimiterEvictsStaleBuckets(t *testing.T) {
	l := newIPRateLimiter(60, 1)
	l.allow("9.9.9.9") // creates the bucket
	l.buckets["9.9.9.9"].lastSeen = time.Now().Add(-staleAfter - time.Minute)

	l.allow("0.0.0.0") // any request sweeps stale entries first

	if _, ok := l.buckets["9.9.9.9"]; ok {
		t.Fatal("stale bucket for 9.9.9.9 was not evicted")
	}
}

func TestClientIPSplitsHostFromPort(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/x", nil)
	r.RemoteAddr = "203.0.113.9:54321"
	if got := clientIP(r); got != "203.0.113.9" {
		t.Fatalf("clientIP = %q, want 203.0.113.9", got)
	}
}

func TestClientIPFallsBackToRawRemoteAddr(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/x", nil)
	r.RemoteAddr = "not-a-host-port"
	if got := clientIP(r); got != "not-a-host-port" {
		t.Fatalf("clientIP = %q, want the raw RemoteAddr as a fallback", got)
	}
}

func TestRateLimitedPassesThroughWhenAllowed(t *testing.T) {
	l := newIPRateLimiter(60, 1)
	called := false
	h := rateLimited(l, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	r := httptest.NewRequest(http.MethodGet, "/x", nil)
	r.RemoteAddr = "1.1.1.1:1"
	rec := httptest.NewRecorder()
	h(rec, r)

	if !called {
		t.Fatal("wrapped handler was not called for a request within the limit")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestRateLimited429sOverTheLimitWithATranslatedBody(t *testing.T) {
	l := newIPRateLimiter(60, 1)
	called := 0
	h := rateLimited(l, func(w http.ResponseWriter, r *http.Request) {
		called++
		w.WriteHeader(http.StatusOK)
	})

	newReq := func() *http.Request {
		r := httptest.NewRequest(http.MethodGet, "/x", nil)
		r.RemoteAddr = "2.2.2.2:1"
		return r
	}

	h(httptest.NewRecorder(), newReq()) // consumes the burst of 1

	rec := httptest.NewRecorder()
	h(rec, newReq())

	if called != 1 {
		t.Fatalf("wrapped handler was called %d times, want 1 (the second request must be blocked)", called)
	}
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", rec.Code)
	}
	if rec.Body.Len() == 0 {
		t.Fatal("a 429 must still carry the uniform error envelope")
	}
}
