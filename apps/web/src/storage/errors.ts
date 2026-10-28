// SPDX-License-Identifier: GPL-3.0-or-later

import { CryptoDomainError } from '../crypto/errors';

/**
 * Errores de dominio de la capa de almacenamiento.
 *
 * Los mensajes son genéricos y en inglés, sin datos del caso. La interfaz traducirá estos errores a
 * textos de usuario en sus archivos de i18n.
 */
export class StorageDomainError extends CryptoDomainError {}

/**
 * El contenido del caso no cumple una invariante del modelo.
 *
 * Se usa, por ejemplo, cuando se cambia la banda final sin una justificación escrita. No extiende
 * `CorruptDataError`: una invariante clínica distinta de un dato ilegible debe poder distinguirse.
 */
export class InvalidCaseDataError extends StorageDomainError {
  constructor() {
    super('Case data is invalid');
  }
}

/** El caso solicitado no existe. */
export class CaseNotFoundError extends StorageDomainError {
  constructor() {
    super('Case not found');
  }
}

/** La fila cambió desde que se leyó; la actualización no se aplica para no perder cambios. */
export class ConcurrentModificationError extends StorageDomainError {
  constructor() {
    super('Case was modified concurrently');
  }
}

/** Se intentó cambiar un campo que debe permanecer inmutable. */
export class ImmutableFieldError extends StorageDomainError {
  constructor() {
    super('Case field cannot be changed');
  }
}
