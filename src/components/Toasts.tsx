import {useEffect} from 'react';
import {X} from 'lucide-react';
import type {Status} from '../health/model';
import {STATUS_ICON} from './ui';
import {useI18n} from '../i18n';

export interface Toast {id: number; status: Status; text: string}

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export default function Toasts({toasts, onDismiss}: Props) {
  const {t} = useI18n();
  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => onDismiss(toasts[0].id), 4500);
    return () => clearTimeout(timer);
  }, [toasts, onDismiss]);

  return (
    <ol className="toasts" aria-live="polite">
      {toasts.map(toast => {
        const Icon = STATUS_ICON[toast.status];
        return (
          <li key={toast.id} className={`toast toast-${toast.status}`}>
            <Icon aria-hidden="true" />
            <span>{toast.text}</span>
            <button className="icon-btn" onClick={() => onDismiss(toast.id)} aria-label={t('toast.dismiss')}><X aria-hidden="true" /></button>
          </li>
        );
      })}
    </ol>
  );
}
