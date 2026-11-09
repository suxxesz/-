import { Component, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="empty error-boundary">
          <AlertCircle size={32} />
          <h1>Не удалось открыть приложение</h1>
          <p>
            Попробуйте перезагрузить страницу. Если ошибка повторяется, обратитесь к администратору
            сервиса.
          </p>
          <button className="primary" onClick={() => location.reload()}>
            Перезагрузить
          </button>
        </div>
      );
    return this.props.children;
  }
}
