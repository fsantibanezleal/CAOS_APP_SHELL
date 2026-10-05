import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useShellLang } from './lang';

interface Props {
  /** Which view this boundary protects; logged and shown so the failure is located, not guessed. */
  panel: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

function FailedView({ panel, error }: { panel: string; error: Error }) {
  const lang = useShellLang();
  return (
    <div className="caos-panel-error" role="alert" data-panel-error={panel}>
      <strong>{lang === 'es' ? 'Esta vista falló.' : 'This view failed.'}</strong>{' '}
      <span>{lang === 'es' ? 'El resto de la página sigue funcionando.' : 'The rest of the page still works.'}</span>
      <code>{error.message}</code>
    </div>
  );
}

/**
 * An error boundary around one view. A failing chart or panel shows an inline message in its own frame instead of
 * blanking the whole page, and the failure is logged with its panel id, which the measured gate fails on (failure
 * class 20 of the 2026-10-04 history: white screens and silent failures).
 */
export class PanelBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[caos-app-shell] view "${this.props.panel}" failed: ${error.message}`, info.componentStack ?? '');
  }

  render(): ReactNode {
    if (this.state.error) return <FailedView panel={this.props.panel} error={this.state.error} />;
    return this.props.children;
  }
}
