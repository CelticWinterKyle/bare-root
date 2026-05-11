"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <p className="text-[#1C1C1A] font-medium mb-2">Something went wrong</p>
          <p className="text-sm text-[#6B6560] mb-4">Try refreshing the page.</p>
          <Link href="/dashboard" className="text-sm text-[#2D5016] underline">
            Back to dashboard
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}
