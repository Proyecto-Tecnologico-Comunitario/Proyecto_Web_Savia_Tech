// SPDX-License-Identifier: GPL-3.0-or-later

import type { MessageKey } from '../i18n';

/** Traduce una clave sin parámetros. */
type Translate = (key: MessageKey) => string;

/**
 * Traducciones de las bandas de muestra.
 *
 * Las claves deben escribirse literales para que la prueba de i18n detecte su uso. Una banda
 * desconocida se muestra con su identificador en lugar de ocultarse.
 */
const BAND_KEYS: Readonly<Record<string, MessageKey>> = {
  minimal: 'band.minimal',
  mild: 'band.mild',
  moderate: 'band.moderate',
  'moderately-severe': 'band.moderately-severe',
  severe: 'band.severe',
};

/** Devuelve la etiqueta traducida de una banda o su identificador si es desconocida. */
export function bandLabel(bandId: string, t: Translate): string {
  const key = BAND_KEYS[bandId];

  return key === undefined ? bandId : t(key);
}
