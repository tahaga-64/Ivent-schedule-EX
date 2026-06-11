import { Component, ErrorInfo, ReactNode } from 'react';
import { isChunkLoadError } from '../lib/lazyWithRetry';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const chunkError = isChunkLoadError(this.state.error);
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <div className="max-w-lg">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-black text-slate-800 mb-2">エラーが発生しました</h1>
            <p className="text-sm text-slate-500 mb-6">
              {chunkError ? (
                <>
                  アプリが更新されたため、画面の読み込みに失敗しました。<br />
                  再読み込みすると最新版が表示されます。
                </>
              ) : (
                <>
                  アプリの読み込み中にエラーが発生しました。<br />
                  Firebase の設定や接続を確認してください。
                </>
              )}
            </p>
            <pre className="text-left text-xs bg-slate-100 rounded-xl p-4 mb-6 overflow-auto text-red-600 max-h-48">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              再読み込み
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
