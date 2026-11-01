// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useMemo, useState } from 'react';

import { useApp } from '../../app/AppContext';
import { VaultLockedError } from '../../crypto/errors';
import { useI18n } from '../../i18n/I18nProvider';
import type { CaseRecord } from '../../model/case';

/** Casos que se piden por página; suficiente para una pantalla de teléfono. */
const PAGE_SIZE = 20;

/** Estado de la carga inicial de la lista. */
type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Lista paginada de casos.
 *
 * Solo muestra el código seudónimo y la fecha de actualización. El contenido clínico se lee al abrir
 * el detalle, nunca se vuelca en la lista. Los casos ilegibles se cuentan pero no se muestran.
 */
export function CaseListScreen() {
  const app = useApp();
  const { locale, t } = useI18n();

  const [items, setItems] = useState<readonly CaseRecord[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [nextOffset, setNextOffset] = useState(0);
  const [unreadable, setUnreadable] = useState(0);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // La carga inicial se repite solo si se pide reintentar.
  useEffect(() => {
    let active = true;
    const epoch = app.vault.getSnapshot().epoch;
    setStatus('loading');
    setLoadMoreFailed(false);

    void Promise.all([app.repository.list({ limit: PAGE_SIZE, offset: 0 }), app.repository.count()])
      .then(([page, count]) => {
        // Una respuesta que llega después de bloquear o de reintentar no se aplica.
        if (!active || app.vault.getSnapshot().epoch !== epoch) {
          return;
        }

        setItems(page.items);
        setUnreadable(page.unreadableIds.length);
        setTotal(count);
        setNextOffset(PAGE_SIZE);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        // Tras un bloqueo la compuerta ya desmontó esta pantalla.
        if (!active || app.vault.getSnapshot().epoch !== epoch) {
          return;
        }

        if (error instanceof VaultLockedError) {
          return;
        }

        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [app.repository, app.vault, reloadToken]);

  // El formato de fecha se reutiliza mientras no cambie el idioma.
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Bogota',
      }),
    [locale],
  );

  const hasMore = total !== null && nextOffset < total;

  /** Pide la siguiente página y la añade a la lista. */
  const loadMore = () => {
    if (loadingMore) {
      return;
    }

    const epoch = app.vault.getSnapshot().epoch;
    const offset = nextOffset;
    setLoadingMore(true);
    setLoadMoreFailed(false);

    void app.repository
      .list({ limit: PAGE_SIZE, offset })
      .then((page) => {
        if (app.vault.getSnapshot().epoch !== epoch) {
          return;
        }

        setItems((previous) => [...previous, ...page.items]);
        setUnreadable((previous) => previous + page.unreadableIds.length);
        setNextOffset(offset + PAGE_SIZE);
      })
      .catch((error: unknown) => {
        if (app.vault.getSnapshot().epoch !== epoch) {
          return;
        }

        if (error instanceof VaultLockedError) {
          return;
        }

        setLoadMoreFailed(true);
      })
      .finally(() => {
        // Si la bóveda se bloqueó, el componente ya no existe.
        if (app.vault.getSnapshot().epoch === epoch) {
          setLoadingMore(false);
        }
      });
  };

  return (
    <section className="case-section" aria-labelledby="cases-title">
      <h2 id="cases-title">{t('cases.title')}</h2>

      {status === 'loading' ? <p role="status">{t('cases.loading')}</p> : null}

      {status === 'error' ? (
        <div role="alert">
          <p className="error">{t('cases.error')}</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setReloadToken((token) => token + 1);
            }}
          >
            {t('cases.retry')}
          </button>
        </div>
      ) : null}

      {status === 'ready' && items.length === 0 && unreadable === 0 ? (
        <p>{t('cases.empty')}</p>
      ) : null}

      {unreadable > 0 ? (
        <p className="warning">{t('cases.unreadable', { count: unreadable })}</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="case-list">
          {items.map((item) => (
            <li key={item.id} className="case-list-item">
              <p className="case-code">{item.code}</p>
              <p className="hint">
                {t('cases.updatedAt', { date: dateFormatter.format(item.updatedAt) })}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {loadMoreFailed ? (
        <p className="error" role="alert">
          {t('cases.loadMoreError')}
        </p>
      ) : null}

      {status === 'ready' && hasMore ? (
        <button
          type="button"
          className="button button-secondary"
          disabled={loadingMore}
          onClick={loadMore}
        >
          {loadingMore ? t('cases.loading') : t('cases.loadMore')}
        </button>
      ) : null}
    </section>
  );
}
