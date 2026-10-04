import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { ApiError } from "./apiError";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      retry: (failureCount, error) => {
        const err = error as ApiError;
        // Never retry client errors (4xx) or cancelled requests (especially 401 and 403).
        if (err?.status >= 400 && err?.status < 500) return false;
        if (err?.code === "network_cancelled") return false;
        // Retry network & server errors up to 2 times.
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      const err = error as ApiError;
      handleGlobalError(err);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      const err = error as ApiError;
      handleGlobalError(err);
    },
  }),
});

function handleGlobalError(err: ApiError) {
  // ── Auth errors → silent (handled by AuthContext / HTTP interceptor) ──
  if (err.status === 401 || err.status === 403) {
    return;
  }

  // ── 404 → silent (handled by component-level empty states) ──
  if (err.status === 404) {
    return;
  }

  // ── Validation errors (400/422) ──
  if (err.status === 422 || err.status === 400) {
    // Forms handle their own field-level errors. Only show a toast if
    // the error bubbled without field mapping.
    if (!err.fields) {
      toast({
        variant: "destructive",
        title: "خطأ في الإدخال",
        description: err.message || "الرجاء التأكد من صحة البيانات المدخلة.",
      });
    }
    return;
  }

  // ── Conflict (409) ──
  if (err.status === 409) {
    toast({
      variant: "destructive",
      title: "تعارض في البيانات",
      description: err.message || "حدث تعارض مع حالة النظام الحالية.",
    });
    return;
  }

  // ── Network errors (status === 0) → differentiated by code ──
  if (err.isNetwork) {
    // Cancelled requests (e.g. component unmount) → completely silent.
    if (err.code === "network_cancelled") return;

    if (err.isOffline) {
      toast({
        variant: "destructive",
        title: "انقطاع الاتصال",
        description: "أنت حالياً غير متصل بالإنترنت. سيتم استئناف الطلبات عند عودة الاتصال.",
      });
    } else if (err.isTimeout) {
      toast({
        variant: "destructive",
        title: "انتهت مهلة الطلب",
        description: "استغرق الطلب وقتاً طويلاً. يرجى المحاولة مرة أخرى.",
      });
    } else {
      // Connection refused, CORS block, or unknown network error.
      // Show "server unreachable" — NOT "you're offline".
      toast({
        variant: "destructive",
        title: "تعذّر الاتصال بالخادم",
        description: err.message,
      });
    }
    return;
  }

  // ── Server errors (5xx) ──
  if (err.status >= 500) {
    toast({
      variant: "destructive",
      title: "خطأ في الخادم",
      description: "نواجه مشكلة في الخادم حالياً. يرجى المحاولة لاحقاً.",
    });
    return;
  }

  // ── Fallback ──
  toast({
    variant: "destructive",
    title: "حدث خطأ",
    description: err.message,
  });
}
