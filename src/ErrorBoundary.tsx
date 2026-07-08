import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle ?? '组件异常';
      return (
        <div style={{ color: '#ef4444', padding: '20px', background: 'rgba(15,17,21,0.95)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#fca5a5' }}>{title}</h3>
          <details style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: '#94a3b8' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
