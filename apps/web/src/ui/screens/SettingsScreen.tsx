// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef, useState } from 'react';

import { useI18n } from '../../i18n/I18nProvider';
import type { Locale, MessageKey } from '../../i18n';
import { AUTO_LOCK_OPTIONS_MS, type SettingsStore } from '../../settings/settingsStore';
import { estimateStorage, type PersistenceStatus, type StorageEstimateResult } from '../../storage';

/** Propiedades de la pantalla de ajustes. */
interface SettingsScreenProps {
  /** Almacén de ajustes no sensibles. */
  readonly settings: SettingsStore;
  /** Estado de la persistencia solicitada tras desbloquear. */
  readonly persistence: PersistenceStatus | null;
  /** Guarda el nuevo plazo y reinicia el auto-lock. */
  readonly onAutoLockChange: (ms: number) => void;
  /** Vuelve a la pantalla anterior. */
  readonly onBack: () => void;
}

/** Convierte bytes a megabytes con un decimal. */
function formatMegabytes(bytes: number): string {
  // Se usa la convención de 1 MB = 1024 * 1024 bytes para coincidir con la API del navegador.
  return (bytes / 1_048_576).toFixed(1);
}

/** Pantalla de ajustes: idioma, auto-lock y estado del almacenamiento. */
export function SettingsScreen({
  settings,
  persistence,
  onAutoLockChange,
  onBack,
}: SettingsScreenProps) {
  const { locale, setLocale, t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // El plazo se mantiene en estado local para reflejar el cambio de inmediato.
  const [autoLockMs, setAutoLockMs] = useState(() => settings.load().autoLockMs);

  // La estimación se pide al montar; si la API no está disponible no se muestra la línea.
  const [estimate, setEstimate] = useState<StorageEstimateResult | null>(null);

  // Al montar la pantalla, el foco va al título.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Se estima el uso una sola vez; un fallo devuelve null y no rompe la pantalla.
  useEffect(() => {
    let active = true;

    void estimateStorage().then((result) => {
      if (active) {
        setEstimate(result);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // Cada opción se muestra en minutos; el valor guardado sigue siendo milisegundos.
  const autoLockOptions = AUTO_LOCK_OPTIONS_MS.map((ms) => ({
    ms,
    label: t('settings.autolock.option', { minutes: ms / 60_000 }),
  }));

  // El estado de persistencia se traduce a una clave concreta.
  const persistenceKey: MessageKey | null =
    persistence === 'granted'
      ? 'settings.storage.granted'
      : persistence === 'denied'
        ? 'settings.storage.denied'
        : persistence === 'unsupported'
          ? 'settings.storage.unsupported'
          : null;

  // Cambiar de idioma actualiza el contexto y persiste en el almacén.
  const handleLocaleChange = (next: Locale): void => {
    setLocale(next);
  };

  // Cambiar el plazo lo guarda y reinicia el temporizador del auto-lock.
  const handleAutoLockChange = (next: number): void => {
    setAutoLockMs(next);
    onAutoLockChange(next);
  };

  return (
    <main id="main" className="screen">
      <h1 ref={headingRef} tabIndex={-1}>
        {t('settings.title')}
      </h1>

      <button type="button" className="button button-secondary" onClick={onBack}>
        {t('settings.back')}
      </button>

      <fieldset className="settings-group">
        <legend>{t('settings.language')}</legend>
        <label className="radio-row">
          <input
            type="radio"
            name="locale"
            value="es"
            checked={locale === 'es'}
            onChange={() => handleLocaleChange('es')}
          />
          <span>{t('settings.language.es')}</span>
        </label>
        <label className="radio-row">
          <input
            type="radio"
            name="locale"
            value="en"
            checked={locale === 'en'}
            onChange={() => handleLocaleChange('en')}
          />
          <span>{t('settings.language.en')}</span>
        </label>
      </fieldset>

      <div className="settings-group">
        <label htmlFor="auto-lock">{t('settings.autolock')}</label>
        <select
          id="auto-lock"
          value={autoLockMs}
          aria-describedby="auto-lock-help"
          onChange={(event) => handleAutoLockChange(Number(event.currentTarget.value))}
        >
          {autoLockOptions.map((option) => (
            <option key={option.ms} value={option.ms}>
              {option.label}
            </option>
          ))}
        </select>
        <p id="auto-lock-help" className="hint">
          {t('settings.autolock.help')}
        </p>
      </div>

      <section className="settings-group" aria-labelledby="storage-title">
        <h2 id="storage-title">{t('settings.storage')}</h2>
        {persistenceKey === null ? null : <p>{t(persistenceKey)}</p>}
        {estimate === null ? null : (
          <p>
            {t('settings.storage.usage', {
              usage: formatMegabytes(estimate.usage),
              quota: formatMegabytes(estimate.quota),
            })}
          </p>
        )}
      </section>
    </main>
  );
}
