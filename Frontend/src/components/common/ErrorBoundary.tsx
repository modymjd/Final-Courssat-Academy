import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { logger } from "@/lib/logger";
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("ErrorBoundary caught error:", { error, errorInfo });
    
    const errorId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    this.setState({ errorId });

    Sentry.captureException(error, { 
      extra: { componentStack: errorInfo.componentStack },
      tags: { errorId }
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 p-8 text-center" dir="rtl">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">حدث خطأ غير متوقع</h2>
          <p className="text-muted-foreground max-w-md">
            نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.
            <br />
            {this.state.error && <span className="text-xs text-destructive mt-2 block">{this.state.error.message}</span>}
            {this.state.errorId && (
              <span className="text-xs text-muted-foreground mt-2 block font-mono">
                رمز الخطأ: {this.state.errorId}
              </span>
            )}
          </p>
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: undefined, errorId: undefined });
              window.location.reload();
            }}
          >
            إعادة المحاولة
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
