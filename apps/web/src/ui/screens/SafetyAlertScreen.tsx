// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef } from 'react';

import { useI18n } from '../../i18n/I18nProvider';

/** Propiedades de la pantalla de alerta de seguridad. */
interface SafetyAlertScreenProps {
  /** Líneas del protocolo de seguridad en el idioma activo. */
  readonly lines: readonly string[];
  /** Única salida: la profesional confirma que leyó el protocolo. */
  readonly onAcknowledge: () => void;
}

/**
 * Alerta de seguridad previa al resultado.
 *
 * No se puede cerrar con Escape ni con un clic fuera: la única salida es "Entendido", como exige
 * el flujo clínico. El foco va al título dentro del contenedor `role="alert"`.
 */
export function SafetyAlertScreen({ lines, onAcknowledge }: SafetyAlertScreenProps) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // El lector de pantalla anuncia la alerta y su título al entrar.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="safety-alert" aria-labelledby="safety-alert-title">
      <div role="alert">
        <h2 id="safety-alert-title" ref={headingRef} tabIndex={-1}>
          {t('alert.title')}
        </h2>
        <ul>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <button type="button" className="button button-primary" onClick={onAcknowledge}>
        {t('alert.acknowledge')}
      </button>
    </section>
  );
}
